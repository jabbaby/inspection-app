import { afterEach, describe, expect, it } from "vitest";
import {
  clearPageImages,
  keepPageImage,
  queuePageDrawing,
  takePageImage,
} from "./pageImages";

/** A stand-in canvas (the tests run without a DOM). */
function canvas(width: number, height: number) {
  return { width, height, remove() {} } as unknown as HTMLCanvasElement;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => clearPageImages());

describe("kept page images", () => {
  it("hands a kept image back once, at the same scale only", () => {
    const c = canvas(2000, 1400);
    keepPageImage("d:1@1", c, 1);
    expect(takePageImage("d:1@1", 1.5)).toBeNull();
    // Taken at the wrong scale, it was let go.
    expect(c.width).toBe(0);
    const d = canvas(2000, 1400);
    keepPageImage("d:1@1", d, 1);
    expect(takePageImage("d:1@1", 1.005)).toBe(d);
    expect(takePageImage("d:1@1", 1)).toBeNull();
  });

  it("lets the oldest go beyond about four A1 pages", () => {
    const kept = [1, 2, 3, 4, 5].map((n) => {
      const c = canvas(2380, 1680); // 4 MP
      keepPageImage(`d:${n}@${n}`, c, 1);
      return c;
    });
    expect(kept[0].width).toBe(0);
    expect(takePageImage("d:1@1", 1)).toBeNull();
    expect(takePageImage("d:5@5", 1)).toBe(kept[4]);
  });
});

describe("page drawing queue", () => {
  it("draws one page at a time, pages on screen first", async () => {
    const order: string[] = [];
    const finish = new Map<string, () => void>();
    const job = (name: string) => (done: () => void) => {
      order.push(name);
      finish.set(name, done);
      return () => order.push(`cancel ${name}`);
    };
    queuePageDrawing(1, job("near"));
    queuePageDrawing(0, job("visible"));
    queuePageDrawing(1, job("near 2"));
    await tick();
    expect(order).toEqual(["visible"]);
    finish.get("visible")!();
    expect(order).toEqual(["visible", "near"]);
    finish.get("near")!();
    expect(order).toEqual(["visible", "near", "near 2"]);
    finish.get("near 2")!();
  });

  it("cancels a running drawing and starts the next", async () => {
    const order: string[] = [];
    const cancelFirst = queuePageDrawing(0, () => {
      order.push("first");
      return () => order.push("cancel first");
    });
    queuePageDrawing(0, (done) => {
      order.push("second");
      done();
      return () => {};
    });
    await tick();
    cancelFirst();
    expect(order).toEqual(["first", "cancel first", "second"]);
  });

  it("pauses background work for a page on screen, then runs it again", async () => {
    const order: string[] = [];
    const finish = new Map<string, () => void>();
    const job = (name: string) => (done: () => void) => {
      order.push(name);
      finish.set(name, done);
      return () => order.push(`pause ${name}`);
    };
    queuePageDrawing(2, job("background"));
    await tick();
    queuePageDrawing(0, job("visible"));
    expect(order).toEqual(["background", "pause background"]);
    await tick();
    expect(order).toEqual(["background", "pause background", "visible"]);
    // The paused run ending late changes nothing.
    finish.get("background")!();
    expect(order.at(-1)).toBe("visible");
    finish.get("visible")!();
    expect(order.at(-1)).toBe("background");
    finish.get("background")!();
  });

  it("drops a waiting drawing that's cancelled before it starts", async () => {
    const order: string[] = [];
    let finishFirst = () => {};
    queuePageDrawing(0, (done) => {
      order.push("first");
      finishFirst = done;
      return () => {};
    });
    const cancelSecond = queuePageDrawing(0, () => {
      order.push("second");
      return () => {};
    });
    await tick();
    cancelSecond();
    finishFirst();
    expect(order).toEqual(["first"]);
  });
});
