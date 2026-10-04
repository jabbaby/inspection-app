import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, test } from "vitest";
import type { Item, Photo } from "../../db/types";
import { loadTestMemoAssets } from "../memo/pdf/memoAssets.testutil";
import { writeMemo } from "../memo/pdf/renderMemoPdf";
import { sampleMemo } from "../memo/sampleMemo";
import {
  appendixGroups,
  fitPhoto,
  layoutAppendix,
  type AppendixGroup,
} from "./appendixLayout";
import { appendPhotoAppendix } from "./renderAppendix";

const photo = (id: string, caption?: string): Photo => ({
  id,
  blobId: `blob-${id}`,
  source: "library",
  caption,
  takenAt: 0,
  width: 1600,
  height: 1200,
});

const item = (over: Partial<Item>): Item => ({
  id: crypto.randomUUID(),
  inspectionId: "i1",
  letter: "A",
  kind: "instruction",
  drawingId: "d1",
  page: 1,
  x: 0.5,
  y: 0.5,
  text: "",
  requiresPhotoConfirmation: false,
  photoIds: [],
  createdAt: 0,
  sequence: 0,
  arrows: [],
  ...over,
});

describe("appendixGroups", () => {
  test("instructions, then observations, then General, labelled IA1 / OA1 / G1", () => {
    const photos = new Map(
      ["p1", "p2", "p3", "p4", "p5"].map((id) => [id, photo(id)]),
    );
    const groups = appendixGroups(
      [
        item({
          kind: "observation",
          letter: "A",
          text: "Crack",
          photoIds: ["p3"],
        }),
        item({ letter: "B", text: "", photoIds: ["p2"] }),
        item({ letter: "A", text: " Add bar ", photoIds: ["p1", "p4"] }),
        item({ letter: "C", text: "No photos" }),
      ],
      ["p5", "missing"],
      photos,
    );
    expect(groups.map((g) => g.title)).toEqual([
      "Instruction A – Add bar",
      "Instruction B",
      "Observation A – Crack",
      "General",
    ]);
    expect(groups.flatMap((g) => g.photos.map((p) => p.label))).toEqual([
      "Photo IA1",
      "Photo IA2",
      "Photo IB1",
      "Photo OA1",
      "Photo G1",
    ]);
  });
});

describe("layoutAppendix", () => {
  const group = (title: string, n: number): AppendixGroup => ({
    title,
    photos: Array.from({ length: n }, (_, i) => ({
      photo: photo(`${title}${i}`),
      label: `${title}${i + 1}`,
    })),
  });

  test("each group starts a row; two rows of two per page", () => {
    const pages = layoutAppendix([group("A", 3), group("B", 1)]);
    expect(
      pages.map((p) => p.rows.map((r) => [r.heading, r.photos.length])),
    ).toEqual([
      [
        ["A", 2],
        [null, 1],
      ],
      [["B", 1]],
    ]);
  });

  test("a group carried onto a new page repeats its title", () => {
    const pages = layoutAppendix([group("A", 6)]);
    expect(pages.map((p) => p.rows.map((r) => r.heading))).toEqual([
      ["A", null],
      ["A (continued)"],
    ]);
  });

  test("no photos, no pages", () => {
    expect(layoutAppendix([])).toEqual([]);
  });
});

test("fitPhoto keeps the shape inside the box", () => {
  expect(
    fitPhoto({ width: 1600, height: 1200 }, { width: 240, height: 280 }),
  ).toEqual({
    width: 240,
    height: 180,
  });
  expect(
    fitPhoto({ width: 1200, height: 1600 }, { width: 240, height: 280 }),
  ).toEqual({
    width: 210,
    height: 280,
  });
});

/** A tiny valid JPEG (1 x 1, white), so tests need no image files. */
const JPEG = Uint8Array.from(
  atob(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  ),
  (c) => c.charCodeAt(0),
);

test("appendix pages carry the reference, groups, labels, captions and page numbers", async () => {
  const doc = await PDFDocument.create();
  const memo = await writeMemo(doc, sampleMemo, await loadTestMemoAssets());
  const groups = appendixGroups(
    [item({ letter: "A", text: "Add N12 bar", photoIds: ["p1", "p2"] })],
    ["p3"],
    new Map([
      ["p1", photo("p1", "Bar missing at lap")],
      ["p2", photo("p2")],
      ["p3", photo("p3", "Overall view")],
    ]),
  );
  const added = await appendPhotoAppendix(doc, {
    pages: layoutAppendix(groups),
    title: "SIM-001 – Level 3 slab reinforcement",
    firstPageNumber: memo.pages.length + 3,
    fonts: memo.fonts,
    icon: memo.icon,
    loadPhoto: async () => ({ data: JPEG, type: "image/jpeg" }),
  });
  expect(added).toBe(1);

  const pdf = await pdfjs.getDocument({ data: await doc.save() }).promise;
  const last = await pdf.getPage(pdf.numPages);
  const text = (await last.getTextContent()).items
    .map((it) => ("str" in it ? it.str : ""))
    .join(" ")
    .replace(/\s+/g, " ");
  expect(text).toContain("SIM-001 – Level 3 slab reinforcement");
  expect(text).toContain("Photo appendix");
  expect(text).toContain("Instruction A – Add N12 bar");
  expect(text).toContain("Photo IA1");
  expect(text).toContain("– Bar missing at lap");
  expect(text).toContain("Photo IA2");
  expect(text).toContain("General");
  expect(text).toContain("Photo G1");
  expect(text).toContain(String(memo.pages.length + 3));
  await pdf.loadingTask.destroy();
});
