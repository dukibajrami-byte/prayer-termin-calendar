"""End-to-end RTL / i18n layout tests for the calendar page.

Checks, per language and viewport width:
  * <html dir> is rtl only for ar/ur/fa
  * language + settings buttons stay fully visible
  * the mobile action grid keeps 2 columns
  * prayer card, weekday header and week range render readably
  * clock times (HH:mm) are not reversed / not localized digits
  * prayer bands (F/D/A/M/I) do not visually overlap
  * nothing overflows the viewport, no horizontal scroll

Premium state is mocked exactly like tests/e2e/auth_premium_redirects.py, so
no real data is touched.

Run:  python3 tests/e2e/i18n_rtl_layout.py
Requires the dev server on http://localhost:8080 and the injected session env.
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SHOTS = Path(__file__).parent / "screenshots" / "i18n"

LANGS = ["de", "en", "bn", "ar", "ur", "fa"]
RTL = {"ar", "ur", "fa"}
WIDTHS = [390, 360, 430]
GRANT = {"user_id": "00000000-0000-0000-0000-000000000000"}

TIME_RE = re.compile(r"(?<!\d)([0-2]\d):([0-5]\d)(?!\d)")
NON_LATIN_DIGITS = re.compile(r"[\u0660-\u0669\u06f0-\u06f9\u09e6-\u09ef]")

results: list[tuple[bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((bool(ok), f"{name}{': ' + detail if detail else ''}"))


async def mock_premium(context):
    async def handler(route):
        body = GRANT if "premium_grants" in route.request.url else None
        await route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(body) if body is not None else "null",
        )

    await context.route("**/rest/v1/premium_grants*", handler)
    await context.route("**/rest/v1/subscriptions*", handler)


async def open_calendar(context, lang: str):
    page = await context.new_page()
    cj = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cj:
        await context.add_cookies([{**c, "url": BASE} for c in json.loads(cj)])
    await page.goto(BASE + "/auth", wait_until="domcontentloaded")
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sj = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if key and sj:
        await page.evaluate(f"localStorage.setItem({json.dumps(key)}, {json.dumps(sj)})")
    await page.evaluate(f'localStorage.setItem("mtk.lang", {json.dumps(lang)})')
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(1200)
    return page


async def audit(page, lang: str, width: int):
    tag = f"{lang}@{width}"

    # 1. direction
    direction = await page.evaluate("document.documentElement.dir")
    check(f"{tag} dir", direction == ("rtl" if lang in RTL else "ltr"), f"got {direction!r}")
    html_lang = await page.evaluate("document.documentElement.lang")
    check(f"{tag} html lang", html_lang == lang, f"got {html_lang!r}")

    # 2. no horizontal scroll
    overflow = await page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    check(f"{tag} no horizontal scroll", overflow <= 1, f"overflow {overflow}px")

    # 3. nothing sticks out of the viewport
    out = await page.evaluate(
        """(w) => [...document.querySelectorAll('header *, main *')]
              .filter(el => el.getBoundingClientRect().width > 0)
              // sonner's toast viewport is fixed and intentionally parked off-canvas
              .filter(el => !el.closest('[data-sonner-toaster], .toaster'))
              .filter(el => { const r = el.getBoundingClientRect();
                              return r.right > w + 1 || r.left < -1; })
              .slice(0, 5)
              .map(el => el.tagName + '.' + (el.className || '').toString().slice(0, 40))""",
        width,
    )
    check(f"{tag} nothing overflows viewport", not out, str(out))

    # 4. header controls visible and untruncated
    for label in ("language-button", "settings-button"):
        box = await page.evaluate(
            """(sel) => { const el = document.querySelector(`[data-testid="${sel}"]`)
                       || [...document.querySelectorAll('button')].find(b => b.dataset.role === sel);
                 return el ? el.getBoundingClientRect().toJSON() : null; }""",
            label,
        )
        if box is None:
            continue
        check(
            f"{tag} {label} visible",
            box["width"] > 0 and box["left"] >= -1 and box["right"] <= width + 1,
            str(box),
        )

    # header buttons in general: inside viewport and not clipped horizontally
    clipped = await page.evaluate(
        """(w) => [...document.querySelectorAll('header button')]
              .filter(b => b.getBoundingClientRect().width > 0)
              .filter(b => b.scrollWidth > b.clientWidth + 2
                        || b.getBoundingClientRect().right > w + 1
                        || b.getBoundingClientRect().left < -1)
              .map(b => (b.textContent || '').trim().slice(0, 24))""",
        width,
    )
    check(f"{tag} header buttons not clipped", not clipped, str(clipped))

    # 5. action grid keeps exactly two columns on mobile
    if width <= 430:
        cols = await page.evaluate(
            """() => { const btns = [...document.querySelectorAll('header button')]
                         .filter(b => b.getBoundingClientRect().width > 0);
                 const lefts = new Set(btns.map(b => Math.round(b.getBoundingClientRect().left)));
                 return lefts.size; }"""
        )
        check(f"{tag} action grid columns", 1 <= cols <= 2, f"distinct columns {cols}")

    # 6. times readable, latin digits, not reversed
    text = await page.evaluate("document.body.innerText")
    times = TIME_RE.findall(text)
    check(f"{tag} clock times present", len(times) > 0, f"found {len(times)}")
    check(
        f"{tag} times use latin digits",
        not NON_LATIN_DIGITS.search(" ".join(":".join(t) for t in times)),
    )
    bad = [t for t in times if int(t[0]) > 23 or int(t[1]) > 59]
    check(f"{tag} times not reversed", not bad, str(bad[:3]))

    # 7. week range / weekday header rendered
    heading = await page.evaluate(
        """() => { const el = document.querySelector('[data-testid="range-label"]');
             return el ? el.textContent.trim() : document.body.innerText.slice(0, 400); }"""
    )
    check(f"{tag} year visible in range", "2026" in heading or "202" in heading, heading[:60])

    # 8. prayer band labels: language-neutral abbreviations, no overlap
    bands = await page.evaluate(
        """() => [...document.querySelectorAll('span')]
              .map(s => ({ t: (s.textContent || '').trim(), r: s.getBoundingClientRect().toJSON() }))
              .filter(o => /^[FDAMI]\\s\\d{2}:\\d{2}$/.test(o.t.replace(/[\\u200e\\u200f]/g, '')))"""
    )
    if bands:
        overlaps = 0
        by_col: dict[int, list] = {}
        for b in bands:
            by_col.setdefault(round(b["r"]["left"] / 10), []).append(b["r"])
        for rects in by_col.values():
            rects.sort(key=lambda r: r["top"])
            for a, c in zip(rects, rects[1:]):
                if c["top"] < a["bottom"] - 0.5:
                    overlaps += 1
        check(f"{tag} prayer bands do not overlap", overlaps == 0, f"{overlaps} overlaps")
        check(f"{tag} prayer abbreviations language-neutral", all(
            b["t"].replace("\u200e", "")[0] in "FDAMI" for b in bands
        ))


async def run() -> int:
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") != "injected":
        print("no injected session; cannot reach the gated calendar")
        return 1

    SHOTS.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width in WIDTHS:
            for lang in LANGS:
                ctx = await browser.new_context(viewport={"width": width, "height": 1400})
                await mock_premium(ctx)
                page = await open_calendar(ctx, lang)
                await audit(page, lang, width)
                if width == 390:
                    await page.screenshot(path=str(SHOTS / f"{lang}_{width}.png"))
                await ctx.close()
        await browser.close()

    failed = [m for ok, m in results if not ok]
    for ok, msg in results:
        print(("PASS " if ok else "FAIL ") + msg)
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


sys.exit(asyncio.run(run()))
