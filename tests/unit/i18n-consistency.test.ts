import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LANGS, RTL_LANGS, dirFor, type Lang } from "@/lib/i18n";
import * as extra from "@/lib/i18n-extra";

const SRC = fileURLToPath(new URL("../../src/lib/i18n.tsx", import.meta.url));
const source = readFileSync(SRC, "utf8");

/** Extracts a `const <name>: Dict = { ... };` literal's key/value pairs. */
function inlineDict(name: string): Record<string, string> {
  const start = source.indexOf(`const ${name}: Dict = {`);
  if (start < 0) throw new Error(`inline dict "${name}" not found in i18n.tsx`);
  const from = source.indexOf("{", start);
  let depth = 0;
  let end = from;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = source.slice(from + 1, end);
  const out: Record<string, string> = {};
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|`([^`]*)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]!] = (m[2] ?? m[3] ?? "") as string;
  return out;
}

const DICTS: Record<Lang, Record<string, string>> = {
  de: inlineDict("de"),
  en: inlineDict("en"),
  ar: inlineDict("ar"),
  sq: inlineDict("sq"),
  tr: inlineDict("tr"),
  fr: extra.fr,
  ur: extra.ur,
  id: extra.id,
  ms: extra.ms,
  bn: extra.bn,
  fa: extra.fa,
  ru: extra.ru,
  es: extra.es,
  nl: extra.nl,
  bs: extra.bs,
};

const CODES = Object.keys(LANGS) as Lang[];
const REFERENCE = Object.keys(DICTS.en).sort();

describe("i18n registry", () => {
  it("registers exactly the 15 expected languages", () => {
    expect(CODES.sort()).toEqual(
      ["ar", "bn", "bs", "de", "en", "es", "fa", "fr", "id", "ms", "nl", "ru", "sq", "tr", "ur"].sort(),
    );
  });

  it("marks only ar, ur, fa as RTL", () => {
    expect([...RTL_LANGS].sort()).toEqual(["ar", "fa", "ur"]);
    for (const code of CODES) {
      expect(dirFor(code)).toBe(["ar", "ur", "fa"].includes(code) ? "rtl" : "ltr");
    }
  });

  it("has a non-empty display name for each language", () => {
    for (const code of CODES) expect(LANGS[code].trim().length).toBeGreaterThan(0);
  });
});

describe("i18n dictionaries", () => {
  it("has a reference dictionary with keys", () => {
    expect(REFERENCE.length).toBeGreaterThan(100);
  });

  for (const code of CODES) {
    describe(code, () => {
      it("has the same key count as english", () => {
        expect(Object.keys(DICTS[code]).length).toBe(REFERENCE.length);
      });

      it("has no missing keys", () => {
        const missing = REFERENCE.filter((k) => !(k in DICTS[code]));
        expect(missing).toEqual([]);
      });

      it("has no unexpected extra keys", () => {
        const extraKeys = Object.keys(DICTS[code]).filter((k) => !REFERENCE.includes(k));
        expect(extraKeys).toEqual([]);
      });

      it("has no empty values", () => {
        const empty = Object.entries(DICTS[code])
          .filter(([, v]) => !v || !v.trim())
          .map(([k]) => k);
        expect(empty).toEqual([]);
      });

      it("keeps the same interpolation placeholders as english", () => {
        const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
        const mismatched = REFERENCE.filter(
          (k) => placeholders(DICTS.en[k]!) !== placeholders(DICTS[code][k] ?? ""),
        );
        expect(mismatched).toEqual([]);
      });
    });
  }
});
