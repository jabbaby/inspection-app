/**
 * The Inspection Companion buddy (engineer's mascot, 2026-10-07): a little
 * inspector in a hard hat holding a clipboard. The app's own mark, used in
 * the app only (About, first run), never on anything that goes to a client.
 * Lines in the current text colour; the clipboard and hand are filled with
 * --buddy-fill (the surface behind it), so they sit in front of the body.
 */
export function Buddy({ size = 64 }: { size?: number }) {
  return (
    <svg
      className="buddy"
      width={size}
      height={size * 1.24}
      viewBox="0 0 100 124"
      fill="none"
      stroke="currentColor"
      strokeWidth={5.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Body and feet, behind the clipboard. */}
      <path d="M37 82 Q28 93 30 106 Q31 113 38 112 Q44 111 47 105 Q50 111 56 112 Q63 112 64 104" />
      {/* Face, under the brim. */}
      <path d="M21 50 C21 72 32 83 50 83 C68 83 79 72 79 50" />
      <circle cx="37" cy="63" r="6" fill="currentColor" stroke="none" />
      <circle cx="63" cy="63" r="6" fill="currentColor" stroke="none" />
      {/* Hard hat: dome, front ridge and brim. */}
      <path d="M21 41 C21 19 35 9 50 9 C65 9 79 19 79 41" />
      <rect x="43" y="7" width="14" height="23" rx="4" />
      <rect x="10" y="40" width="80" height="11" rx="5.5" />
      {/* Clipboard, tilted, held up in front, and the hand on its edge. */}
      <g className="buddy-fill" transform="translate(0 6)">
        <rect
          x="54"
          y="72"
          width="26"
          height="36"
          rx="4"
          transform="rotate(14 67 90)"
        />
        <rect
          x="61"
          y="68"
          width="12"
          height="7"
          rx="2.5"
          transform="rotate(14 67 90)"
        />
        <circle cx="84" cy="96" r="5" />
      </g>
    </svg>
  );
}
