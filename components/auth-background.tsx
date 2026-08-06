const APRICOT = "#fdba74";
const APRICOT_SOFT = "#fed7aa";

/** Small filled bird matching the login badge's shape, in apricot tones. */
function DecoBird({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="14.5" cy="18" r="8.5" fill={APRICOT} />
      <path d="M20 15C24 9 28 8 27 13c-1 4-4.5 5-7 3.5Z" fill={APRICOT_SOFT} />
      <path d="M6.5 17l-4 1.4 4 1.5Z" fill={APRICOT_SOFT} />
    </svg>
  );
}

/** Rounded speech bubble with a tail. */
function SpeechBubble({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9.5L6 20v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill={APRICOT}
      />
    </svg>
  );
}

type Deco = {
  type: "bird" | "at" | "bubble";
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
};

// Hand-placed (not random, to stay SSR-stable) and biased toward the margins so
// the scatter reads around the centered card. Light density = background texture.
const DECOS: Deco[] = [
  { type: "bird", top: "9%", left: "14%", size: 27, rotate: -12, opacity: 0.17 },
  { type: "bubble", top: "6%", left: "49%", size: 22, rotate: -6, opacity: 0.15 },
  { type: "at", top: "13%", left: "84%", size: 24, rotate: 9, opacity: 0.16 },
  { type: "bird", top: "22%", left: "91%", size: 20, rotate: 14, opacity: 0.16 },
  { type: "bird", top: "33%", left: "6%", size: 29, rotate: 7, opacity: 0.15 },
  { type: "at", top: "41%", left: "94%", size: 21, rotate: -10, opacity: 0.17 },
  { type: "bubble", top: "52%", left: "4%", size: 24, rotate: 10, opacity: 0.15 },
  { type: "at", top: "64%", left: "9%", size: 19, rotate: 6, opacity: 0.16 },
  { type: "bird", top: "61%", left: "92%", size: 26, rotate: -9, opacity: 0.16 },
  { type: "bubble", top: "75%", left: "88%", size: 20, rotate: 12, opacity: 0.15 },
  { type: "bird", top: "89%", left: "19%", size: 24, rotate: 11, opacity: 0.17 },
  { type: "bird", top: "93%", left: "51%", size: 22, rotate: -7, opacity: 0.15 },
  { type: "at", top: "85%", left: "68%", size: 22, rotate: 5, opacity: 0.16 },
  { type: "bubble", top: "90%", left: "83%", size: 19, rotate: -12, opacity: 0.15 },
];

/** Decorative dark backdrop scattered with faded apricot social icons. */
export function AuthBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {DECOS.map((d, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            top: d.top,
            left: d.left,
            opacity: d.opacity,
            transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
          }}
        >
          {d.type === "bird" ? (
            <DecoBird size={d.size} />
          ) : d.type === "bubble" ? (
            <SpeechBubble size={d.size} />
          ) : (
            <span
              style={{
                fontSize: d.size,
                lineHeight: 1,
                fontWeight: 700,
                color: APRICOT,
              }}
            >
              @
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
