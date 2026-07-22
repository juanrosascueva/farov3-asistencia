import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const collect = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? collect(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []);
const files = collect("src").filter((file) => file !== "src/components/UiIcon.tsx");
const forbidden = /(?:bg|text|border|ring|from|to)-(?:green|red|blue|teal|amber|coral|sage|cyan|emerald|orange|purple|slate)-\d{2,3}/;
const arbitraryMicro = /text-\[(?:9|10\.5|11)px\]/;
const violations = files.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  const result = [];
  if (forbidden.test(text)) result.push(`${file}: color token legacy`);
  if (arbitraryMicro.test(text)) result.push(`${file}: typography token legacy`);
  return result;
});

if (violations.length) {
  console.error("Design token violations:\n" + violations.join("\n"));
  process.exit(1);
}
console.log("Design tokens OK.");
