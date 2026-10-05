import {
  ChevronDown,
  Eraser,
  Highlighter,
  MapPin,
  Pen,
  Pointer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MarkupTool } from "../../db/types";
import { WEIGHT_PRESETS, WEIGHT_RANGE } from "./markGeometry";
import {
  MAX_SLOTS,
  PRESET_COLOURS,
  addSlot,
  recolourSlot,
  removeSlot,
  selectSlot,
  toolColour,
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
const TOOL_NAMES: Record<MarkupTool, string> = {
  pen: "Pen",
  highlighter: "Highlighter",
};

const HINTS: Partial<Record<ViewerTool, string>> = {
  pin: "Tap for an instruction · double-tap for an observation · hold and drag for an arrow",
  eraser: "Touch a mark to remove it",
};

/** An open slider or colour panel, under the button that opened it (screen px). */
interface Open {
  which: "weight" | "colour";
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
 * pen and highlighter show three weights and their colour slots inline.
 * The slot in use shows a ⌄: tapping it again opens its colour panel.
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
      {/* Centred; re-centres as a tool's options come and go. */}
      <div className="markup-toolbar-row">
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
            onClose={() => setOpen(null)}
            onOpen={(which, button) => {
              const r = button.getBoundingClientRect();
              setOpen((o) =>
                o?.which === which
                  ? null
                  : {
                      which,
                      left: Math.max(
                        8,
                        Math.min(r.left - 12, innerWidth - 260),
                      ),
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
    </div>
  );
}

function InkOptions({
  tool,
  open,
  onClose,
  onOpen,
}: {
  tool: MarkupTool;
  open: Open | null;
  onClose: () => void;
  onOpen: (which: Open["which"], button: HTMLElement) => void;
}) {
  const prefs = useMarkupPrefs();
  const weight = prefs.weight[tool];
  const selected = prefs.selected[tool];
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
      {prefs.palettes[tool].map((c, i) => (
        <button
          // Slots can share a colour: the position is the identity.
          key={i}
          type="button"
          className={`markup-swatch${light(c) ? " markup-swatch-light" : ""}`}
          style={{ backgroundColor: c }}
          aria-label={`Colour ${c}`}
          aria-pressed={i === selected}
          aria-expanded={i === selected ? open?.which === "colour" : undefined}
          title={i === selected ? "Tap again to change this colour" : c}
          onClick={(e) => {
            if (i === selected) return onOpen("colour", e.currentTarget);
            onClose();
            updatePrefs((p) => selectSlot(p, tool, i));
          }}
        >
          {i === selected && <ChevronDown aria-hidden="true" strokeWidth={3} />}
        </button>
      ))}

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
      {open?.which === "colour" && (
        <ColourPanel tool={tool} at={{ left: open.left, top: open.top }} />
      )}
    </>
  );
}

/** Whether a colour is light enough to need a dark ⌄ on it. */
function light(colour: string) {
  const n = parseInt(colour.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

/**
 * The slot in use, GoodNotes style: pick a colour for it (the iPad's
 * picker recolours it as it moves and never adds one), add a colour at the
 * end of the row, or remove this one.
 */
function ColourPanel({
  tool,
  at,
}: {
  tool: MarkupTool;
  at: { left: number; top: number };
}) {
  const prefs = useMarkupPrefs();
  const colour = toolColour(prefs, tool);
  const slots = prefs.palettes[tool].length;
  return (
    <div
      className="markup-popover markup-colour-panel"
      role="group"
      aria-label={`${TOOL_NAMES[tool]} colour`}
      style={at}
    >
      <p className="markup-panel-title">
        <span
          className="markup-swatch"
          style={{ backgroundColor: colour }}
          aria-hidden="true"
        />
        {TOOL_NAMES[tool]} colour
      </p>
      <div className="markup-palette">
        {PRESET_COLOURS[tool].map((c) => (
          <button
            key={c}
            type="button"
            className="markup-swatch"
            style={{ backgroundColor: c }}
            aria-label={`Use ${c}`}
            aria-pressed={c.toUpperCase() === colour.toUpperCase()}
            onClick={() => updatePrefs((p) => recolourSlot(p, tool, c))}
          />
        ))}
      </div>
      <label className="markup-custom">
        Custom…
        <input
          type="color"
          aria-label="Custom colour"
          value={colour.toLowerCase()}
          // Fires as the picker moves: it only ever recolours this slot.
          onChange={(e) =>
            updatePrefs((p) => recolourSlot(p, tool, e.target.value))
          }
        />
      </label>
      <div className="markup-panel-actions">
        <button
          type="button"
          onClick={() => updatePrefs((p) => addSlot(p, tool))}
          title={slots >= MAX_SLOTS ? `Up to ${MAX_SLOTS} colours` : undefined}
        >
          Add colour
        </button>
        {slots > 1 && (
          <button
            type="button"
            className="danger-outline"
            onClick={() => updatePrefs((p) => removeSlot(p, tool))}
          >
            Remove
          </button>
        )}
      </div>
      {slots >= MAX_SLOTS && (
        <p className="markup-note">
          The row is full ({MAX_SLOTS} colours): remove one to add another.
        </p>
      )}
    </div>
  );
}
