/** Today's date as YYYY-MM-DD in the device's local time zone (not UTC). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-01" -> "1 October 2026". Other strings are returned as entered. */
export function formatLongDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName} ${year}` : isoDate;
}

/** "1 Oct 2026, 3:42 pm" for a timestamp, in local time. */
export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

/** "2026-10-01" -> "01/10/2026". Other strings are returned as entered. */
export function formatDdMmYyyy(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : isoDate;
}
