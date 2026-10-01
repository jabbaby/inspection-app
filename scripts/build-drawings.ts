// Writes the synthetic test drawings to fixtures/generated/ (gitignored).
// Run with `npm run fixtures:drawings`.
import { mkdirSync, writeFileSync } from "node:fs";
import {
  HEAVY_DRAWING,
  TYPICAL_DRAWING,
  buildSyntheticDrawing,
} from "../src/features/drawings/fixtures/syntheticDrawing.ts";

const dir = "fixtures/generated";
mkdirSync(dir, { recursive: true });

for (const [name, sheets] of [
  ["synthetic-typical.pdf", TYPICAL_DRAWING],
  ["synthetic-heavy.pdf", HEAVY_DRAWING],
] as const) {
  const bytes = await buildSyntheticDrawing([...sheets]);
  writeFileSync(`${dir}/${name}`, bytes);
  console.log(`Wrote ${dir}/${name} (${Math.round(bytes.length / 1024)} KB)`);
}
