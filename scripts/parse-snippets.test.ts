import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseSnippets } from "./parse-snippets.ts";

describe("parseSnippets", () => {
  const markdown = readFileSync("docs/content/snippets.md", "utf8");

  test("reads the starter set: 4 body, 2 condition, 2 heading", () => {
    const snippets = parseSnippets(markdown);
    const count = (kind: string) =>
      snippets.filter((s) => s.kind === kind).length;

    expect(count("body")).toBe(4);
    expect(count("condition")).toBe(2);
    expect(count("heading")).toBe(2);
    expect(
      snippets.find((s) => s.id === "heading-noted-for-information")?.text,
    ).toBe("Noted for information:");
  });

  test("src/content/snippets.json is up to date (run npm run snippets:build)", () => {
    const built = JSON.parse(
      readFileSync("src/content/snippets.json", "utf8"),
    ) as unknown;
    expect(built).toEqual(parseSnippets(markdown));
  });
});
