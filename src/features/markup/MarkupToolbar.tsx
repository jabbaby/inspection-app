import {
  ChevronDown,
  Circle,
  Cloud,
  Eraser,
  Highlighter,
  MapPin,
  MoveUpRight,
  Pen,
  Pointer,
  Slash,
  Square,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SHAPES, type MarkupShape, type MarkupTool } from "../../db/types";
import { WEIGHT_PRESETS, WEIGHT_RANGE } from "./markGeometry";
import {
  MAX_SLOTS,
  PRESET_COLOURS,
  addSlot,
  paletteOf,
  recolourSlot,
  removeSlot,
  selectSlot,
  toolColour,
  updatePrefs,
  useMarkupPrefs,
} from "./markupPrefs";
import type { ViewerTool } from "./tools";

/**
 * Text callout: a box of text with a dog-leg leader to an arrowhead, drawn
 * on Lucide's 24 px grid in its style (engineer: "show it's a callout, not
 * just a T").
 */
const Callout = createLucideIcon("callout", [
  [
    "rect",
    { x: "10", y: "3", width: "11", height: "9", rx: "1.5", key: "box" },
  ],
  ["path", { d: "M13 6.5h5", key: "line1" }],
  ["path", { d: "M13 9h3", key: "line2" }],
  ["path", { d: "M10 7.5H7L3.5 20", key: "leader" }],
  ["path", { d: "M2.4 16.6 3.5 20l2.7-2.3", key: "head" }],
]);

/** The toolbar's buttons: tools, with each shape a button of its own. */
const BUTTONS: {
  id: string;
  label: string;
  Icon: LucideIcon;
  tool: ViewerTool;
  shape?: MarkupShape;
}[] = [
  { id: "pin", label: "Pin", Icon: MapPin, tool: "pin" },
  { id: "pen", label: "Pen", Icon: Pen, tool: "pen" },
  { id: "eraser", label: "Eraser", Icon: Eraser, tool: "eraser" },
  {
    id: "highlighter",
    label: "Highlighter",
    Icon: Highlighter,
    tool: "highlighter",
  },
  ...SHAPES.map((shape) => ({
    id: shape,
    label: "",
    Icon: Cloud,
    tool: "shapes" as const,
    shape,
  })),
  { id: "text", label: "Text", Icon: Callout, tool: "text" },
];

const SHAPE_ICONS: Record<MarkupShape, LucideIcon> = {
  line: Slash,
  arrow: MoveUpRight,
  rect: Square,
  ellipse: Circle,
  cloud: Cloud,
};

const SHAPE_NAMES: Record<MarkupShape, string> = {
  line: "Line",
  arrow: "Arrow",
  rect: "Rectangle",
  ellipse: "Ellipse",
  cloud: "Revision cloud",
};

const WEIGHT_NAMES = ["Thin", "Medium", "Thick"];
/** Text has sizes instead of weights. */
const SIZE_NAMES = ["Small", "Medium", "Large"];
const TOOL_NAMES: Record<MarkupTool, string> = {
  pen: "Pen",
  highlighter: "Highlighter",
  shapes: "Shape",
  text: "Text",
};

const HINTS: Partial<Record<ViewerTool, string>> = {
  pin: "Tap for an instruction · double-tap for an observation · hold and drag for an arrow",
  eraser: "Touch a mark to remove it · tap inside a shape to take its fill off",
  text: "Tap for a text box · hold and drag for an arrow",
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
    tool === "pen" ||
    tool === "highlighter" ||
    tool === "shapes" ||
    tool === "text"
      ? tool
      : null;

  function openAt(which: Open["which"], button: HTMLElement) {
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
  }

  // A tap anywhere else closes the slider or palette.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  /** Whether a button's tool (and shape) is the one on. */
  const isOn = (b: (typeof BUTTONS)[number]) =>
    tool === b.tool && (!b.shape || prefs.shape === b.shape);

  function choose(b: (typeof BUTTONS)[number]) {
    setOpen(null);
    if (isOn(b)) return onTool(null);
    if (b.shape)
      updatePrefs((p) => {
        p.shape = b.shape!;
      });
    onTool(b.tool);
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
        {BUTTONS.map((b) => {
          const Icon = b.shape ? SHAPE_ICONS[b.shape] : b.Icon;
          const label = b.shape ? SHAPE_NAMES[b.shape] : b.label;
          return (
            <button
              key={b.id}
              type="button"
              className={`markup-tool${b.id === "pin" ? " markup-tool-pin" : ""}`}
              aria-label={label}
              aria-pressed={isOn(b)}
              title={label}
              onClick={() => choose(b)}
            >
              <Icon aria-hidden="true" strokeWidth={2.25} />
            </button>
          );
        })}
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
            onOpen={openAt}
          />
        )}
        {tool && HINTS[tool] && (
          // Beside a tool's options (Text) the hint shows only where it
          // fits: not in portrait.
          <span
            className={`markup-hint-group${inkTool ? " beside-options" : ""}`}
          >
            <span className="markup-divider" aria-hidden="true" />
            <span className="markup-hint">{HINTS[tool]}</span>
          </span>
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
  const names = tool === "text" ? SIZE_NAMES : WEIGHT_NAMES;

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
            aria-label={names[i]}
            aria-pressed={on}
            title={on ? `${names[i]}: tap again to adjust` : names[i]}
            onClick={(e) => {
              if (on) onOpen("weight", e.currentTarget);
              else
                updatePrefs((p) => {
                  p.weight[tool] = preset;
                });
            }}
          >
            {tool === "text" ? (
              <span className="markup-size" style={{ fontSize: 12 + 3 * i }}>
                {"SML"[i]}
              </span>
            ) : (
              <span style={{ height: [2, 4, 7][i] }} />
            )}
          </button>
        );
      })}
      <span className="markup-divider" aria-hidden="true" />
      {prefs.palettes[paletteOf(tool)].map((c, i) => (
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
  const slots = prefs.palettes[paletteOf(tool)].length;
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
        {PRESET_COLOURS[paletteOf(tool)].map((c) => (
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
