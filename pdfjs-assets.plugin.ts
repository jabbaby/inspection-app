import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const PDFJS = fileURLToPath(
  new URL("./node_modules/pdfjs-dist/", import.meta.url),
);

// Data pdf.js loads at runtime: standard fonts (for PDFs that don't embed
// them, common in CAD exports), CMaps, ICC profiles and image decoders.
const DIRS = ["standard_fonts", "cmaps", "iccs", "wasm"];
// JavaScript-in-PDF support and non-wasm fallbacks are not needed.
const SKIP = /quickjs|nowasm/;

function assetFiles(): string[] {
  return DIRS.flatMap((dir) =>
    readdirSync(join(PDFJS, dir))
      .filter((name) => !SKIP.test(name))
      .map((name) => `${dir}/${name}`),
  );
}

/**
 * Serves pdf.js runtime data at `<base>pdfjs/` in dev and emits it into the
 * build, where the service worker precaches it, so drawings open offline
 * without any CDN.
 */
export function pdfjsAssets(): Plugin {
  let base = "/";
  return {
    name: "pdfjs-assets",
    configResolved(config) {
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use(`${base}pdfjs/`, (req, res, next) => {
        const path = normalize(
          decodeURIComponent((req.url ?? "").split("?")[0]),
        );
        const file = join(PDFJS, path);
        if (
          !file.startsWith(PDFJS) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        ) {
          next();
          return;
        }
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const file of [...assetFiles(), "LICENSE"]) {
        this.emitFile({
          type: "asset",
          fileName: `pdfjs/${file}`,
          source: readFileSync(join(PDFJS, file)),
        });
      }
    },
  };
}
