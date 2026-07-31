export function MqulimaLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Stem/Stalk */}
      <path d="M 50 95 V 15" stroke="#1B5E20" strokeWidth="3.5" strokeLinecap="round" />

      {/* Left Leaves (Forest Green) */}
      {/* Bottom Leaf */}
      <path d="M 50 90 C 35 90, 26 80, 25 65 C 35 67, 46 76, 50 90 Z" fill="#2D6A2F" />
      {/* Second Leaf */}
      <path d="M 50 72 C 35 72, 26 62, 25 47 C 35 49, 46 58, 50 72 Z" fill="#2D6A2F" />
      {/* Third Leaf */}
      <path d="M 50 54 C 35 54, 26 44, 25 29 C 35 31, 46 40, 50 54 Z" fill="#2D6A2F" />
      {/* Top Leaf */}
      <path d="M 50 36 C 37 36, 30 28, 28 15 C 36 17, 46 25, 50 36 Z" fill="#2D6A2F" />

      {/* Right Leaves (Lighter Mid-Green) */}
      {/* Bottom Leaf */}
      <path d="M 50 90 C 65 90, 74 80, 75 65 C 65 67, 54 76, 50 90 Z" fill="#4CAF50" />
      {/* Second Leaf */}
      <path d="M 50 72 C 65 72, 74 62, 75 47 C 65 49, 54 58, 50 72 Z" fill="#4CAF50" />
      {/* Third Leaf */}
      <path d="M 50 54 C 65 54, 74 44, 75 29 C 65 31, 54 40, 50 54 Z" fill="#4CAF50" />
      {/* Top Leaf */}
      <path d="M 50 36 C 63 36, 70 28, 72 15 C 64 17, 54 25, 50 36 Z" fill="#4CAF50" />

      {/* Technology Circuit Lines (Yellow/Gold & Green) */}
      {/* Bottom Node */}
      <path
        d="M 72 68 L 84 62 H 93"
        stroke="#EAB308"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="93" cy="62" r="3.5" fill="#EAB308" />

      {/* Middle Node */}
      <path
        d="M 73 50 L 86 44 H 96"
        stroke="#84CC16"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="96" cy="44" r="3.5" fill="#84CC16" />

      {/* Top Node */}
      <path
        d="M 72 32 L 83 25 H 90"
        stroke="#EAB308"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="90" cy="25" r="3.5" fill="#EAB308" />
    </svg>
  );
}
