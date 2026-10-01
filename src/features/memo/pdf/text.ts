import type { PDFFont } from "pdf-lib";

/** A piece of text in one font. Lines are built from runs so styles can mix. */
export interface Run {
  text: string;
  font: PDFFont;
}

const characterSets = new WeakMap<PDFFont, Set<number>>();

/**
 * Replaces characters the font cannot draw (emoji, unusual symbols) with "?"
 * so pdf-lib never throws on user-entered text. Tabs become spaces.
 */
export function toEncodable(text: string, font: PDFFont): string {
  let set = characterSets.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    characterSets.set(font, set);
  }
  let out = "";
  for (const char of text.replace(/\t/g, " ")) {
    const code = char.codePointAt(0)!;
    out += char === "\n" || set.has(code) ? char : "?";
  }
  return out;
}

export function runWidth(run: Run, size: number): number {
  return run.font.widthOfTextAtSize(run.text, size);
}

/** Splits a word that is wider than the line into pieces that fit. */
function breakLongWord(word: Run, size: number, maxWidth: number): Run[] {
  const pieces: Run[] = [];
  let current = "";
  for (const char of word.text) {
    if (
      current &&
      word.font.widthOfTextAtSize(current + char, size) > maxWidth
    ) {
      pieces.push({ text: current, font: word.font });
      current = char;
    } else {
      current += char;
    }
  }
  if (current) pieces.push({ text: current, font: word.font });
  return pieces;
}

/**
 * Word-wraps runs to `maxWidth`. "\n" forces a line break. Returns lines of
 * runs with no leading or trailing spaces. An empty input gives no lines.
 */
export function wrapRuns(runs: Run[], size: number, maxWidth: number): Run[][] {
  const lines: Run[][] = [];
  let line: Run[] = [];
  let lineWidth = 0;
  let pendingSpace: Run | null = null;

  const pushLine = () => {
    lines.push(line);
    line = [];
    lineWidth = 0;
    pendingSpace = null;
  };

  const addWord = (word: Run) => {
    const spaceWidth = pendingSpace ? runWidth(pendingSpace, size) : 0;
    const wordWidth = runWidth(word, size);
    if (line.length > 0 && lineWidth + spaceWidth + wordWidth > maxWidth) {
      pushLine();
    }
    if (line.length === 0 && wordWidth > maxWidth) {
      const pieces = breakLongWord(word, size, maxWidth);
      pieces.slice(0, -1).forEach((piece) => {
        line.push(piece);
        pushLine();
      });
      const last = pieces[pieces.length - 1];
      line.push(last);
      lineWidth = runWidth(last, size);
      return;
    }
    if (line.length > 0 && pendingSpace) {
      line.push(pendingSpace);
      lineWidth += spaceWidth;
    }
    line.push(word);
    lineWidth += wordWidth;
    pendingSpace = null;
  };

  let hasContent = false;
  for (const run of runs) {
    for (const token of run.text.split(/(\n| +)/)) {
      if (token === "") continue;
      hasContent = true;
      if (token === "\n") {
        pushLine();
      } else if (token.startsWith(" ")) {
        if (line.length > 0) pendingSpace = { text: " ", font: run.font };
      } else {
        addWord({ text: token, font: run.font });
      }
    }
  }
  if (line.length > 0 || (hasContent && lines.length === 0)) lines.push(line);
  return mergeRuns(lines);
}

/** Joins neighbouring runs in the same font so each line draws in few calls. */
function mergeRuns(lines: Run[][]): Run[][] {
  return lines.map((line) =>
    line.reduce<Run[]>((merged, run) => {
      const last = merged[merged.length - 1];
      if (last && last.font === run.font) {
        last.text += run.text;
      } else {
        merged.push({ ...run });
      }
      return merged;
    }, []),
  );
}

/** Convenience for single-font text. */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  return wrapRuns([{ text, font }], size, maxWidth).map((line) =>
    line.map((run) => run.text).join(""),
  );
}
