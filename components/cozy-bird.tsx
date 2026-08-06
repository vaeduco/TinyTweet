import { cn } from "@/lib/utils";

/**
 * Friendly, redrawn TinyTweet bird — rounded body, one wing raised in a
 * cheerful wave, warm amber tones — sitting in a soft 56px badge. Used on the
 * auth pages.
 */
export function CozyBird({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-14 w-14 items-center justify-center rounded-full",
        className
      )}
      style={{ backgroundColor: "#fef3c7" }}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* feet */}
        <path
          d="M16.5 33 v3.5 M23.5 33 v3.5"
          stroke="#b45309"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* crest tufts peeking from behind the head */}
        <path
          d="M17 9 q1.5 -3.5 3 -0.5 M20 8.5 q1.8 -3.5 3.4 0"
          stroke="#d97706"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* rounded body */}
        <circle cx="20" cy="21" r="13" fill="#f59e0b" />
        {/* soft belly */}
        <ellipse cx="20" cy="24.5" rx="8" ry="8.5" fill="#fde68a" />
        {/* tucked wing (left) */}
        <path
          d="M9.5 19 C6 21 6 26 9.5 27 C11.5 26.5 12.5 23 12 20.5 Z"
          fill="#d97706"
        />
        {/* raised, waving wing (right, up) */}
        <path
          d="M27 17 C31 9 37 7 37 12 C37 17 32.5 21 28.5 20.5 Z"
          fill="#d97706"
        />
        {/* beak */}
        <path d="M20 19.5 l-3 2.4 h6 Z" fill="#b45309" />
        {/* eyes */}
        <circle cx="16.4" cy="17" r="1.8" fill="#4b2410" />
        <circle cx="23.6" cy="17" r="1.8" fill="#4b2410" />
        {/* eye highlights */}
        <circle cx="17.1" cy="16.3" r="0.55" fill="#fffdf7" />
        <circle cx="24.3" cy="16.3" r="0.55" fill="#fffdf7" />
      </svg>
    </span>
  );
}
