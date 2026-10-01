// Test-only: loads memo assets from disk (Vitest runs in Node, no fetch of file URLs).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { northrop } from "../../../brand/northrop";
import type { FontKey, MemoAssets } from "./renderMemoPdf";

const read = async (url: string) =>
  new Uint8Array(await readFile(fileURLToPath(url)));

export async function loadTestMemoAssets(): Promise<MemoAssets> {
  const { fonts, wordmarkCream, icon } = northrop.assets;
  const keys = Object.keys(fonts) as FontKey[];
  const loaded = await Promise.all(keys.map((key) => read(fonts[key])));
  return {
    fonts: Object.fromEntries(keys.map((key, i) => [key, loaded[i]])) as Record<
      FontKey,
      Uint8Array
    >,
    wordmarkCream: await read(wordmarkCream),
    icon: await read(icon),
  };
}
