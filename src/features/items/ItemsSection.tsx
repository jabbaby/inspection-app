import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router";
import { db } from "../../db/db";
import { indexForLetter } from "./letters";

/** All items in letter order; each opens its drawing at the pin. */
export function ItemsSection({ inspectionId }: { inspectionId: string }) {
  const data = useLiveQuery(async () => {
    const [items, drawings] = await Promise.all([
      db.items.where("inspectionId").equals(inspectionId).toArray(),
      db.drawings.where("inspectionId").equals(inspectionId).toArray(),
    ]);
    items.sort((a, b) => indexForLetter(a.letter) - indexForLetter(b.letter));
    return { items, names: new Map(drawings.map((d) => [d.id, d.name])) };
  }, [inspectionId]);

  return (
    <div className="later-section" aria-labelledby="items-heading">
      <h2 id="items-heading">Items</h2>
      {data && data.items.length === 0 && (
        <p className="muted">No items yet. Open a drawing and use Add pin.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className="item-list" aria-label="Items">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/inspections/${inspectionId}/document?item=${item.id}`}
                className="item-row"
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
                      : "Observation"}
                    {item.kind === "instruction" &&
                    item.requiresPhotoConfirmation
                      ? " · photo confirmation"
                      : ""}{" "}
                    · {data.names.get(item.drawingId) ?? "Drawing"}, page{" "}
                    {item.page}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
