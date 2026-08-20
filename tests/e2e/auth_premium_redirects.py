"""End-to-end redirect tests for the auth / premium access gate.

Covers every redirect between /auth, /premium and the calendar (/), for:
  * signed-out visitors
  * signed-in users without premium access
  * signed-in users with an active premium_grant
  * signed-in users with a trialing Stripe subscription

Premium state is simulated by intercepting the backend REST reads for
`premium_grants` and `subscriptions`, so the test never mutates real data.

Run:  python3 tests/e2e/auth_premium_redirects.py
Requires the dev server on http://localhost:8080 and (for the signed-in
cases) the injected browser session env vars.
"""

import asyncio
import json
import os
import sys

from urllib.parse import quote

from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
PROTECTED = ["/", "/todo", "/qibla"]

GRANT = {"user_id": "00000000-0000-0000-0000-000000000000"}
TRIALING = {
    "status": "trialing",
    "price_id": "price_test",
    "current_period_end": "2999-01-01T00:00:00Z",
    "cancel_at_period_end": False,
}

results: list[tuple[bool, str]] = []


def check(name: str, actual, expected) -> None:
    ok = actual == expected
    results.append((ok, f"{name}: expected {expected!r}, got {actual!r}"))


async def mock_premium(context, grant=None, subscription=None):
    async def handler(route):
        url = route.request.url
        body = grant if "premium_grants" in url else subscription
        await route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(body) if body is not None else "null",
        )

    await context.route("**/rest/v1/premium_grants*", handler)
    await context.route("**/rest/v1/subscriptions*", handler)


async def restore_session(context, page):
    cj = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cj:
        await context.add_cookies([{**c, "url": BASE} for c in json.loads(cj)])
    await page.goto(BASE + "/auth", wait_until="domcontentloaded")
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sj = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not (key and sj):
        return False
    await page.evaluate(f"localStorage.setItem({json.dumps(key)}, {json.dumps(sj)})")
    return True


async def landing(context, path: str) -> str:
    """Open `path` in a fresh tab and return the path the app settles on."""
    page = await context.new_page()
    await page.goto(BASE + path, wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(1200)
    url = page.url[len(BASE) :]
    await page.close()
    return url or "/"


async def run() -> int:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # --- signed out -------------------------------------------------
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        for path in PROTECTED:
            check(f"signed-out {path}", await landing(ctx, path), f"/auth?next={quote(path, safe='')}")
        check("signed-out /auth", await landing(ctx, "/auth"), "/auth")
        check("signed-out /premium", await landing(ctx, "/premium"), "/premium")
        await ctx.close()

        status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
        if status != "injected":
            results.append((False, f"no injected session (status={status!r}); signed-in cases skipped"))
            await browser.close()
            return 1

        # --- signed in, no premium -------------------------------------
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await restore_session(ctx, page)
        await mock_premium(ctx, grant=None, subscription=None)
        for path in PROTECTED:
            check(f"no-premium {path}", await landing(ctx, path), "/premium")
        check("no-premium /premium", await landing(ctx, "/premium"), "/premium")
        await ctx.close()

        # --- signed in, premium_grant ----------------------------------
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await restore_session(ctx, page)
        await mock_premium(ctx, grant=GRANT, subscription=None)
        check("grant /", await landing(ctx, "/"), "/")
        check("grant /todo", await landing(ctx, "/todo"), "/todo")
        check("grant /premium redirects", await landing(ctx, "/premium"), "/")
        check("grant /premium?manage=1 stays", await landing(ctx, "/premium?manage=1"), "/premium?manage=1")
        await ctx.close()

        # --- signed in, trialing subscription --------------------------
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await restore_session(ctx, page)
        await mock_premium(ctx, grant=None, subscription=TRIALING)
        check("trialing /", await landing(ctx, "/"), "/")
        check("trialing /premium redirects", await landing(ctx, "/premium"), "/")
        await ctx.close()

        await browser.close()

    failed = [m for ok, m in results if not ok]
    for ok, msg in results:
        print(("PASS " if ok else "FAIL ") + msg)
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
