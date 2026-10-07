// Renders the app's documents (docs/manual/*.md) into Northrop-branded A4
// PDFs in public/docs/, bundled with the app so About opens them offline.
// Run with `npm run docs:build` after editing the markdown or the screenshots
// (`npm run docs:shots`).
//
// The markdown is a small subset: a front matter block (title, subtitle,
// audience), "# " sections (each starts a page), "## " and "### " headings,
// paragraphs with **bold**, "- " bullets, "1. " numbered steps, "> " notes,
// "![Caption](shots/name.jpg)" (or .png; "![Caption|180](...)" caps its
// height in points) screenshots and "<!-- page -->" breaks.
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { northrop } from "../src/brand/northrop.ts";

const DOCS = [
  {
    source: "docs/manual/features-and-limitations.md",
    target: "features-and-limitations.pdf",
  },
  { source: "docs/manual/user-guide.md", target: "user-guide.pdf" },
];

const { width: W, height: H } = northrop.page;
const MARGIN = 60;
const TOP = 70;
const BOTTOM = 66;
const CONTENT = W - 2 * MARGIN;

function hex(value: string): RGB {
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const RED = hex(northrop.colours.red);
const MAROON = hex(northrop.colours.maroon);
const GREY = hex(northrop.colours.grey);
const MUTED = hex(northrop.colours.muted);
const CREAM = hex(northrop.colours.cream);
const RULE = hex(northrop.colours.rule);

const file = (url: string) => readFileSync(fileURLToPath(url));
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

interface Fonts {
  regular: PDFFont;
  semiBold: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

type Block =
  | { kind: "h1" | "h2" | "h3" | "p" | "note"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "step"; n: string; text: string }
  | { kind: "image"; src: string; caption: string; maxHeight: number }
  | { kind: "page" };

function parse(markdown: string) {
  const meta: Record<string, string> = {};
  let body = markdown.replace(/\r\n/g, "\n");
  const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
  if (front) {
    for (const line of front[1].split("\n")) {
      const m = /^(\w+):\s*(.*)$/.exec(line);
      if (m) meta[m[1]] = m[2];
    }
    body = body.slice(front[0].length);
  }
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  /** The block a line starts, if it starts one. */
  const opens = (line: string): Block | null => {
    let m: RegExpExecArray | null;
    if (line === "<!-- page -->") return { kind: "page" };
    if ((m = /^(#{1,3}) (.*)$/.exec(line)))
      return {
        kind: (["h1", "h2", "h3"] as const)[m[1].length - 1],
        text: m[2],
      };
    if ((m = /^- (.*)$/.exec(line))) return { kind: "bullet", text: m[1] };
    if ((m = /^(\d+)\. (.*)$/.exec(line)))
      return { kind: "step", n: m[1], text: m[2] };
    if ((m = /^> (.*)$/.exec(line))) return { kind: "note", text: m[1] };
    if ((m = /^!\[(.*?)(?:\|(\d+))?\]\((.*)\)$/.exec(line)))
      return {
        kind: "image",
        caption: m[1],
        maxHeight: m[2] ? Number(m[2]) : 250,
        src: m[3],
      };
    return null;
  };
  // A blank line ends a bullet, step or note: text after it is a paragraph.
  let afterBlank = false;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      afterBlank = true;
      continue;
    }
    const gap = afterBlank;
    afterBlank = false;
    const block = opens(line);
    if (block) {
      flush();
      blocks.push(block);
      continue;
    }
    // A continuation line of a bullet, step or note, else paragraph text.
    const last = blocks[blocks.length - 1];
    if (
      !para.length &&
      !gap &&
      last &&
      (last.kind === "bullet" || last.kind === "step" || last.kind === "note")
    )
      last.text += ` ${line}`;
    else para.push(line);
  }
  flush();
  return { meta, blocks };
}

interface Run {
  word: string;
  bold: boolean;
  /** Joined to the word before with no space (punctuation after **bold**). */
  glue: boolean;
}

/** Words with their weight: **bold** runs. */
function runs(text: string): Run[] {
  const out: Run[] = [];
  const parts = text.split("**");
  parts.forEach((part, i) => {
    const glued =
      i > 0 && out.length > 0 && !/^\s/.test(part) && !/\s$/.test(parts[i - 1]);
    part
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word, j) =>
        out.push({ word, bold: i % 2 === 1, glue: glued && j === 0 }),
      );
  });
  return out;
}

class Writer {
  pdf: PDFDocument;
  fonts: Fonts;
  page!: PDFPage;
  y = 0;
  title: string;
  wordmark: PDFImage;
  baseDir: string;
  constructor(
    pdf: PDFDocument,
    fonts: Fonts,
    title: string,
    wordmark: PDFImage,
    baseDir: string,
  ) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.title = title;
    this.wordmark = wordmark;
    this.baseDir = baseDir;
  }

  newPage() {
    this.page = this.pdf.addPage([W, H]);
    this.y = H - TOP;
    const mark = this.wordmark.scaleToFit(80, 14);
    this.page.drawImage(this.wordmark, {
      x: W - MARGIN - mark.width,
      y: H - 40,
      width: mark.width,
      height: mark.height,
    });
  }

  /** Room for `h` more points, else a new page. */
  need(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  /** Rich text broken into lines `width` wide. */
  lines(
    text: string,
    width: number,
    size: number,
    base: PDFFont,
    bold: PDFFont,
  ) {
    const words = runs(text);
    const lines: Run[][] = [[]];
    let lineWidth = 0;
    const space = base.widthOfTextAtSize(" ", size);
    for (const w of words) {
      const font = w.bold ? bold : base;
      const ww = font.widthOfTextAtSize(w.word, size);
      const line = lines[lines.length - 1];
      const gap = w.glue ? 0 : space;
      if (line.length && !w.glue && lineWidth + gap + ww > width) {
        lines.push([w]);
        lineWidth = ww;
      } else {
        lineWidth += (line.length ? gap : 0) + ww;
        line.push(w);
      }
    }
    return lines;
  }

  /** Wrapped rich text from `x`, `width` wide, page by page. */
  text(
    text: string,
    x: number,
    width: number,
    size: number,
    colour: RGB,
    base: PDFFont = this.fonts.regular,
    bold: PDFFont = this.fonts.bold,
    lineHeight = size * 1.48,
  ) {
    const space = base.widthOfTextAtSize(" ", size);
    for (const line of this.lines(text, width, size, base, bold)) {
      this.need(lineHeight);
      let cx = x;
      for (const w of line) {
        const font = w.bold ? bold : base;
        if (w.glue && cx > x) cx -= space;
        this.page.drawText(w.word, {
          x: cx,
          y: this.y - size,
          size,
          font,
          color: colour,
        });
        cx += font.widthOfTextAtSize(w.word, size) + space;
      }
      this.y -= lineHeight;
    }
  }

  block(b: Block, first: boolean) {
    const f = this.fonts;
    switch (b.kind) {
      case "page":
        this.newPage();
        return;
      case "h1":
        if (!first) this.newPage();
        this.text(b.text, MARGIN, CONTENT, 22, MAROON, f.bold, f.bold, 28);
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - 2,
          width: 36,
          height: 3,
          color: RED,
        });
        this.y -= 18;
        return;
      case "h2":
        this.need(60);
        this.y -= 10;
        this.text(b.text, MARGIN, CONTENT, 14, MAROON, f.bold, f.bold, 20);
        this.y -= 2;
        return;
      case "h3":
        this.need(44);
        this.y -= 4;
        this.text(b.text, MARGIN, CONTENT, 11.5, GREY, f.semiBold, f.bold, 17);
        return;
      case "p":
        this.text(b.text, MARGIN, CONTENT, 10.5, GREY);
        this.y -= 7;
        return;
      case "bullet":
        this.need(16);
        this.page.drawCircle({
          x: MARGIN + 4,
          y: this.y - 7,
          size: 2.2,
          color: RED,
        });
        this.text(b.text, MARGIN + 14, CONTENT - 14, 10.5, GREY);
        this.y -= 3;
        return;
      case "step":
        this.need(16);
        this.page.drawText(`${b.n}.`, {
          x: MARGIN,
          y: this.y - 10.5,
          size: 10.5,
          font: f.bold,
          color: RED,
        });
        this.text(b.text, MARGIN + 18, CONTENT - 18, 10.5, GREY);
        this.y -= 3;
        return;
      case "note": {
        // A cream box with a red edge, kept on one page.
        const lines = this.lines(b.text, CONTENT - 28, 10, f.regular, f.bold);
        const height = lines.length * 14.8 + 20;
        this.need(height + 6);
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - height,
          width: CONTENT,
          height,
          color: CREAM,
        });
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - height,
          width: 3,
          height,
          color: RED,
        });
        this.y -= 10;
        this.text(b.text, MARGIN + 16, CONTENT - 28, 10, GREY);
        this.y -= 16;
        return;
      }
      case "image":
        // Drawn by drawImageBlock (the image is embedded first).
        return;
    }
  }

  /**
   * A screenshot, at most `maxH` points tall and never enlarged past half
   * its CSS pixels (so a small card stays small).
   */
  drawImageBlock(img: PDFImage, caption: string, maxH: number) {
    const s = Math.min(CONTENT / img.width, maxH / img.height, 0.5);
    const w = img.width * s;
    const h = img.height * s;
    this.need(h + 30);
    this.y -= 4;
    const x = MARGIN + (CONTENT - w) / 2;
    this.page.drawImage(img, { x, y: this.y - h, width: w, height: h });
    this.page.drawRectangle({
      x,
      y: this.y - h,
      width: w,
      height: h,
      borderColor: RULE,
      borderWidth: 0.5,
    });
    this.y -= h + 6;
    if (caption) {
      const cw = this.fonts.italic.widthOfTextAtSize(caption, 9);
      this.page.drawText(caption, {
        x: MARGIN + Math.max(0, (CONTENT - cw) / 2),
        y: this.y - 9,
        size: 9,
        font: this.fonts.italic,
        color: MUTED,
      });
      this.y -= 16;
    }
    this.y -= 8;
  }
}

function cover(
  pdf: PDFDocument,
  fonts: Fonts,
  cream: PDFImage,
  meta: Record<string, string>,
) {
  const page = pdf.addPage([W, H]);
  const band = 170;
  page.drawRectangle({ x: 0, y: 0, width: band, height: H, color: RED });
  const mark = cream.scaleToFit(band - 50, 40);
  page.drawImage(cream, {
    x: 25,
    y: H - 70 - mark.height,
    width: mark.width,
    height: mark.height,
  });
  const x = band + 40;
  const width = W - x - 50;
  let y = H - 260;
  const line = (
    text: string,
    size: number,
    font: PDFFont,
    colour: RGB,
    gap = size * 1.25,
  ) => {
    // Wrapped by words to the column.
    const words = text.split(" ");
    let current = "";
    const out: string[] = [];
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(next, size) > width) {
        out.push(current);
        current = word;
      } else current = next;
    }
    out.push(current);
    for (const l of out) {
      page.drawText(l, { x, y, size, font, color: colour });
      y -= gap;
    }
  };
  line(meta.subtitle ?? "", 13, fonts.semiBold, RED, 30);
  line(meta.title ?? "", 32, fonts.bold, MAROON, 38);
  y -= 10;
  page.drawRectangle({ x, y: y + 10, width: 48, height: 3, color: RED });
  y -= 18;
  if (meta.audience) line(meta.audience, 12, fonts.regular, GREY, 18);
  const date = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  y = 120;
  line(`Version ${pkg.version} · ${date}`, 10.5, fonts.regular, GREY, 16);
  line("Built by David Samson", 10.5, fonts.semiBold, GREY, 16);
  line("Internal document: not for clients.", 9, fonts.italic, MUTED, 14);
}

function footers(pdf: PDFDocument, fonts: Fonts, title: string) {
  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    if (i === 0) return;
    page.drawLine({
      start: { x: MARGIN, y: 44 },
      end: { x: W - MARGIN, y: 44 },
      thickness: 0.5,
      color: RULE,
    });
    page.drawText(`Northrop Hardhat · ${title}`, {
      x: MARGIN,
      y: 30,
      size: 8.5,
      font: fonts.regular,
      color: MUTED,
    });
    const label = `Page ${i + 1} of ${pages.length}`;
    page.drawText(label, {
      x: W - MARGIN - fonts.regular.widthOfTextAtSize(label, 8.5),
      y: 30,
      size: 8.5,
      font: fonts.regular,
      color: MUTED,
    });
  });
}

async function build(source: string, target: string) {
  const { meta, blocks } = parse(readFileSync(source, "utf8"));
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const a = northrop.assets;
  const fonts: Fonts = {
    regular: await pdf.embedFont(file(a.fonts.regular), { subset: true }),
    semiBold: await pdf.embedFont(file(a.fonts.semiBold), { subset: true }),
    bold: await pdf.embedFont(file(a.fonts.bold), { subset: true }),
    italic: await pdf.embedFont(file(a.fonts.italic), { subset: true }),
  };
  const red = await pdf.embedPng(file(a.wordmarkRed));
  const cream = await pdf.embedPng(file(a.wordmarkCream));
  pdf.setTitle(`Northrop Hardhat – ${meta.title}`);
  pdf.setAuthor("David Samson");
  pdf.setCreator("Northrop Hardhat");
  cover(pdf, fonts, cream, meta);
  const writer = new Writer(pdf, fonts, meta.title ?? "", red, dirname(source));
  writer.newPage();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "image") {
      const bytes = readFileSync(join(dirname(source), b.src));
      const img = b.src.endsWith(".png")
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);
      writer.drawImageBlock(img, b.caption, b.maxHeight);
    } else writer.block(b, i === 0);
  }
  footers(pdf, fonts, meta.title ?? "");
  const bytes = await pdf.save();
  const out = join("public/docs", target);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log(
    `Wrote ${out}: ${pdf.getPageCount()} pages, ${(bytes.length / 1024).toFixed(0)} KB`,
  );
}

for (const doc of DOCS) await build(doc.source, doc.target);
