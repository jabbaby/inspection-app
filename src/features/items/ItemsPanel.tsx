import type { Drawing, Item } from "../../db/types";
import { indexForLetter } from "./letters";

interface Props {
  items: Item[];
  drawings: Drawing[];
  onSelect: (item: Item) => void;
  onClose: () => void;
}

/** Every item in the inspection, in letter order, inside the drawings view. */
export function ItemsPanel({ items, drawings, onSelect, onClose }: Props) {
  const names = new Map(drawings.map((d) => [d.id, d.name]));
  const sorted = [...items].sort(
    (a, b) => indexForLetter(a.letter) - indexForLetter(b.letter),
  );

  return (
    <aside className="item-sheet" aria-label="Items" data-testid="items-panel">
      <div className="item-sheet-head">
        <h2>Items</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="muted">No items yet. Use Add pin.</p>
      ) : (
        <ul className="item-list" aria-label="Items in this inspection">
          {sorted.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="item-row"
                onClick={() => onSelect(item)}
              >
                <span
                  className={`item-badge${item.kind === "observation" ? " item-badge-observation" : ""}`}
                  aria-hidden="true"
                >
                  {item.letter}
                </span>
                <span className="item-row-text">
                  <span>
                    <strong>{item.letter}.</strong>{" "}
                    {item.text.trim() || (
                      <span className="muted">No text yet</span>
                    )}
                  </span>
                  <span className="muted">
                    {item.kind === "instruction"
                      ? "Instruction"
                      : "Observation"}{" "}
                    · {names.get(item.drawingId) ?? "Drawing"}, page {item.page}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
