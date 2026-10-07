/** A PDF point in millimetres. */
const MM = 25.4 / 72;

/** "A1 (841 × 594 mm)", or just the size for other papers. */
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
  ];
  const name = sizes.find(
    ([, s, l]) =>
      Math.abs(short - s) <= s * 0.02 && Math.abs(long - l) <= l * 0.02,
  )?.[0];
  return `${name ? `${name} ` : ""}(${w} × ${h} mm)`;
}
