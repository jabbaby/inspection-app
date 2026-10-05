import {
  ChevronDown,
  Eraser,
  Highlighter,
  MapPin,
  Pen,
  Plus,
  Pointer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MarkupTool } from "../../db/types";
import { WEIGHT_PRESETS, WEIGHT_RANGE } from "./markGeometry";
import {
  addColour,
  removeColour,
  updatePrefs,
  useMarkupPrefs,
} from "./markupPrefs";
import type { ViewerTool } from "./tools";

const TOOLS = [
  { id: "pin", label: "Pin", Icon: MapPin },
  { id: "pen", label: "Pen", Icon: Pen },
  { id: "highlighter", label: "Highlighter", Icon: Highlighter },
  { id: "eraser", label: "Eraser", Icon: Eraser },
] as const;

const WEIGHT_NAMES = ["Thin", "Medium", "Thick"];
/** Inline colours before the ⌄ for the rest. */
const INLINE_COLOURS = 6;
/** Holding a saved colour this long removes it. */
const HOLD_MS = 600;

const HINTS: Partial<Record<ViewerTool, string>> = {
  pin: "Tap for an instruction · double-tap for an observation · hold and drag for an arrow",
  eraser: "Touch a mark to remove it",
};

/** An open slider or palette, under the button that opened it (screen px). */
interface Open {
  which: "weight" | "palette";
  left: number;
  top: number;
}

interface Props {
  tool: ViewerTool | null;
  onTool: (tool: ViewerTool | null) => void;
}

/**
 * The markup toolbar (SPEC section 5a): a full-width bar under the screen
 * header, GoodNotes style. Every tool is a toggle (one on at a time); the
 * pen and highlighter show three weights and their saved colours inline.
 */
export function MarkupToolbar({ tool, onTool }: Props) {
  const prefs = useMarkupPrefs();
  const [open, setOpen] = useState<Open | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const inkTool: MarkupTool | null =
    tool === "pen" || tool === "highlighter" ? tool : null;

  // A tap anywhere else closes the slider or palette.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(next: ViewerTool) {
    setOpen(null);
    onTool(tool === next ? null : next);
  }

  return (
    <div
      ref={barRef}
      className="markup-toolbar"
      role="toolbar"
      aria-label="Markup tools"
    >
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`markup-tool${id === "pin" ? " markup-tool-pin" : ""}`}
          aria-label={label}
          aria-pressed={tool === id}
          title={label}
          onClick={() => choose(id)}
        >
          <Icon aria-hidden="true" strokeWidth={2.25} />
        </button>
      ))}
      <button
        type="button"
        className="markup-tool"
        aria-label="Draw with finger"
        aria-pressed={prefs.fingerDraw}
        title={
          prefs.fingerDraw
            ? "Draw with finger: one finger draws, two scroll"
            : "Draw with finger"
        }
        onClick={() =>
          updatePrefs((p) => {
            p.fingerDraw = !p.fingerDraw;
          })
        }
      >
        <Pointer aria-hidden="true" strokeWidth={2.25} />
      </button>

      {inkTool && (
        <InkOptions
          tool={inkTool}
          open={open}
          onOpen={(which, button) => {
            const r = button.getBoundingClientRect();
            setOpen((o) =>
              o?.which === which
                ? null
                : {
                    which,
                    left: Math.max(8, Math.min(r.left - 12, innerWidth - 260)),
                    top: r.bottom + 6,
                  },
            );
          }}
        />
      )}
      {tool && HINTS[tool] && (
        <>
          <span className="markup-divider" aria-hidden="true" />
          <span className="markup-hint">{HINTS[tool]}</span>
        </>
      )}
    </div>
  );
}

function InkOptions({
  tool,
  open,
  onOpen,
}: {
  tool: MarkupTool;
  open: Open | null;
  onOpen: (which: Open["which"], button: HTMLElement) => void;
}) {
  const prefs = useMarkupPrefs();
  const weight = prefs.weight[tool];
  const colour = prefs.colour[tool];
  const palette = prefs.palettes[tool];
  // The chosen colour always shows inline, even from deep in the palette.
  const inline = palette.slice(0, INLINE_COLOURS);
  if (!inline.includes(colour)) inline[inline.length - 1] = colour;
  const [min, max] = WEIGHT_RANGE[tool];

  return (
    <>
      <span className="markup-divider" aria-hidden="true" />
      {WEIGHT_PRESETS[tool].map((preset, i) => {
        const on = Math.abs(preset - weight) < 1e-9;
        return (
          <button
            key={preset}
            type="button"
            className="markup-weight"
            aria-label={WEIGHT_NAMES[i]}
            aria-pressed={on}
            title={
              on ? `${WEIGHT_NAMES[i]}: tap again to adjust` : WEIGHT_NAMES[i]
            }
            onClick={(e) => {
              if (on) onOpen("weight", e.currentTarget);
              else
                updatePrefs((p) => {
                  p.weight[tool] = preset;
                });
            }}
          >
            <span style={{ height: [2, 4, 7][i] }} />
          </button>
        );
      })}
      <span className="markup-divider" aria-hidden="true" />
      {inline.map((c) => (
        <button
          key={c}
          type="button"
          className="markup-swatch"
          style={{ backgroundColor: c }}
          aria-label={`Colour ${c}`}
          aria-pressed={c === colour}
          onClick={() =>
            updatePrefs((p) => {
              p.colour[tool] = c;
            })
          }
        />
      ))}
      <button
        type="button"
        className="markup-more"
        aria-label="All colours"
        aria-expanded={open?.which === "palette"}
        onClick={(e) => onOpen("palette", e.currentTarget)}
      >
        <ChevronDown aria-hidden="true" strokeWidth={2.25} />
      </button>

      {open?.which === "weight" && (
        <div
          className="markup-popover"
          role="group"
          aria-label="Weight"
          style={{ left: open.left, top: open.top }}
        >
          <label className="markup-slider">
            <span>Weight</span>
            <input
              type="range"
              min={Math.log(min)}
              max={Math.log(max)}
              step={0.01}
              value={Math.log(weight)}
              onChange={(e) =>
                updatePrefs((p) => {
                  p.weight[tool] = Math.exp(Number(e.target.value));
                })
              }
            />
          </label>
        </div>
      )}
      {open?.which === "palette" && (
        <Palette tool={tool} at={{ left: open.left, top: open.top }} />
      )}
    </>
  );
}

/** Every saved colour: tap to use, hold to remove, + to add one. */
function Palette({
  tool,
  at,
}: {
  tool: MarkupTool;
  at: { left: number; top: number };
}) {
  const prefs = useMarkupPrefs();
  const picker = useRef<HTMLInputElement>(null);
  const hold = useRef(0);
  /** Set when a hold removed a colour: the click that follows is ignored. */
  const held = useRef(false);

  // The colour picker's "change" (not React's onChange, which fires on
  // every drag in the picker) adds the colour once it closes.
  useEffect(() => {
    const input = picker.current;
    if (!input) return;
    const add = () => addColour(tool, input.value);
    input.addEventListener("change", add);
    return () => input.removeEventListener("change", add);
  }, [tool]);

  return (
    <div
      className="markup-popover"
      role="group"
      aria-label="Saved colours"
      style={at}
    >
      <div className="markup-palette">
        {prefs.palettes[tool].map((c) => (
          <button
            key={c}
            type="button"
            className="markup-swatch"
            style={{ backgroundColor: c }}
            aria-label={`Colour ${c}`}
            aria-pressed={c === prefs.colour[tool]}
            onPointerDown={() => {
              window.clearTimeout(hold.current);
              held.current = false;
              hold.current = window.setTimeout(() => {
                held.current = true;
                removeColour(tool, c);
              }, HOLD_MS);
            }}
            onPointerUp={() => window.clearTimeout(hold.current)}
            onPointerCancel={() => window.clearTimeout(hold.current)}
            onPointerLeave={() => window.clearTimeout(hold.current)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (held.current) return;
              updatePrefs((p) => {
                p.colour[tool] = c;
              });
            }}
          />
        ))}
        <label className="markup-add" title="Add a colour">
          <Plus aria-hidden="true" strokeWidth={2.25} />
          <input
            ref={picker}
            type="color"
            aria-label="Add a colour"
            defaultValue={prefs.colour[tool]}
          />
        </label>
      </div>
      <p className="markup-note">Hold a colour to remove it.</p>
    </div>
  );
}
