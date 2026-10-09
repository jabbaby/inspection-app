/** A PDF point in millimetres. */
const MM = 25.4 / 72;

/** "A1 (841 × 594 mm)" or "B1 (1000 × 707 mm)", or just the size for other papers. */
export function paperLabel(widthPt: number, heightPt: number): string {
  const w = Math.round(widthPt * MM);
  const h = Math.round(heightPt * MM);
  const [short, long] = [Math.min(w, h), Math.max(w, h)];
  const sizes: [string, number, number][] = [
    ["A0", 841, 1189],
    ["A1", 594, 841],
    ["A2", 420, 594],
    ["A3", 297, 420],
    ["A4", 210, 297],
    // ISO B sizes (B1 sheets are common for large drawings).
    ["B0", 1000, 1414],
    ["B1", 707, 1000],
    ["B2", 500, 707],
    ["B3", 353, 500],
    ["B4", 250, 353],
  ];
  const name = sizes.find(
    ([, s, l]) =>
      Math.abs(short - s) <= s * 0.02 && Math.abs(long - l) <= l * 0.02,
  )?.[0];
  return `${name ? `${name} ` : ""}(${w} × ${h} mm)`;
}
