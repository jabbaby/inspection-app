// Converts docs/content/snippets.md into src/content/snippets.json.
// Run with `npm run snippets:build` after editing the markdown.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseSnippets } from "./parse-snippets.ts";

const source = "docs/content/snippets.md";
const target = "src/content/snippets.json";

const snippets = parseSnippets(readFileSync(source, "utf8"));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(snippets, null, 2)}\n`);
console.log(`Wrote ${snippets.length} snippets to ${target}`);
