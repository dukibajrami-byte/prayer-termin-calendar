import { DICTS } from "../src/lib/i18n";
const D = DICTS as any;
const en = Object.keys(D.en);
for (const l of Object.keys(D)) {
  if (l === "en") continue;
  const same = en.filter((k) => D[l][k] === D.en[k]);
  if (same.length) console.log(l, same.map((k) => `${k}="${D.en[k]}"`).join(" | "));
}
