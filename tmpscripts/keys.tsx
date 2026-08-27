import { DICTS } from "../src/lib/i18n";
const en = Object.keys((DICTS as any).en);
for (const [l, d] of Object.entries(DICTS as any)) {
  const miss = en.filter((k) => !(k in (d as any)) || !(d as any)[k]);
  const same = en.filter((k) => l!=="en" && (d as any)[k] === (DICTS as any).en[k]);
  console.log(l, "missing:", miss.length, miss.slice(0,20).join(","), "| identical-to-en:", same.length);
}
