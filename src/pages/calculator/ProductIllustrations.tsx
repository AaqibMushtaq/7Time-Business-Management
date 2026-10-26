
export function HoneyJarIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="honey-jar-body" x1="32" y1="18" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="0.5" stopColor="#D97706" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="honey-lid-grad" x1="32" y1="6" x2="32" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DC2626" />
          <stop offset="1" stopColor="#991B1B" />
        </linearGradient>
        <linearGradient id="honey-glass-shine" x1="18" y1="20" x2="30" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FEF3C7" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Jar Outer Shadow */}
      <ellipse cx="32" cy="59" rx="18" ry="3.5" fill="#000000" fillOpacity="0.08" />
      {/* Lid Rim & Cap */}
      <rect x="20" y="6" width="24" height="4" rx="2" fill="#B91C1C" />
      <rect x="18" y="10" width="28" height="6" rx="2.5" fill="url(#honey-lid-grad)" />
      <rect x="21" y="16" width="22" height="2.5" rx="1" fill="#7F1D1D" />
      {/* Jar Body */}
      <path
        d="M17 18.5H47C50.3137 18.5 53 21.1863 53 24.5V49C53 53.9706 48.9706 58 44 58H20C15.0294 58 11 53.9706 11 49V24.5C11 21.1863 13.6863 18.5 17 18.5Z"
        fill="url(#honey-jar-body)"
      />
      {/* Glass Highlight on Left */}
      <path
        d="M14 26C14 22.5 16.5 20.5 20 20.5H24C19 25 18 35 18 52H16C14.5 48 14 32 14 26Z"
        fill="url(#honey-glass-shine)"
      />
      {/* Label */}
      <rect x="20" y="28" width="24" height="18" rx="3" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1" />
      <circle cx="32" cy="35" r="4.5" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="0.8" />
      <text x="32" y="36.5" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#92400E" fontFamily="system-ui, sans-serif">
        PURE
      </text>
      <text x="32" y="42.5" textAnchor="middle" fontSize="3.8" fontWeight="bold" fill="#78350F" fontFamily="system-ui, sans-serif">
        HONEY
      </text>
    </svg>
  )
}

export function SaffronIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="saffron-bowl" x1="32" y1="32" x2="32" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <radialGradient id="saffron-threads" cx="32" cy="30" r="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DC2626" />
          <stop offset="0.6" stopColor="#B91C1C" />
          <stop offset="1" stopColor="#991B1B" />
        </radialGradient>
      </defs>
      {/* Ground Shadow */}
      <ellipse cx="32" cy="58" rx="18" ry="3.5" fill="#000000" fillOpacity="0.08" />
      {/* Saffron Strands Mound */}
      <ellipse cx="32" cy="32" rx="17" ry="12" fill="url(#saffron-threads)" />
      {/* Individual Saffron Filaments */}
      <path d="M22 28C24 20 28 17 31 16" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30 26C33 19 37 16 41 18" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M26 30C29 23 34 20 37 22" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M34 29C38 22 43 23 45 25" stroke="#B91C1C" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 32C22 26 25 24 28 27" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M36 33C40 26 44 28 47 31" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round" />
      {/* Porcelain Bowl */}
      <path
        d="M14 34C14 46 22 55 32 55C42 55 50 46 50 34H14Z"
        fill="url(#saffron-bowl)"
        stroke="#CBD5E1"
        strokeWidth="1.2"
      />
      <ellipse cx="32" cy="34" rx="18" ry="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
      {/* Gold rim on bowl */}
      <path d="M14 34C14 36 22 38 32 38C42 38 50 36 50 34" stroke="#F59E0B" strokeWidth="1" fill="none" />
    </svg>
  )
}

export function OilBottleIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="oil-bottle-grad" x1="32" y1="20" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" />
          <stop offset="0.6" stopColor="#B45309" />
          <stop offset="1" stopColor="#78350F" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="32" cy="59" rx="14" ry="3" fill="#000000" fillOpacity="0.08" />
      {/* Bottle Cork/Cap */}
      <rect x="29" y="5" width="6" height="5" rx="1.5" fill="#92400E" />
      <rect x="27" y="10" width="10" height="3" rx="1" fill="#B45309" />
      {/* Neck */}
      <rect x="28" y="13" width="8" height="9" fill="#FDE68A" fillOpacity="0.8" />
      {/* Bottle Body */}
      <path
        d="M25 22H39L44 30V54C44 56.5 42 58 39.5 58H24.5C22 58 20 56.5 20 54V30L25 22Z"
        fill="url(#oil-bottle-grad)"
      />
      {/* Glass Highlight */}
      <path d="M23 31V53C23 54.5 24 55.5 25.5 55.5" stroke="#FEF3C7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      {/* Label */}
      <rect x="24" y="34" width="16" height="15" rx="2" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="0.8" />
      <path d="M32 37C30.5 39 30.5 41 32 43C33.5 41 33.5 39 32 37Z" fill="#15803D" />
      <text x="32" y="47" textAnchor="middle" fontSize="3" fontWeight="bold" fill="#78350F" fontFamily="system-ui, sans-serif">
        OIL
      </text>
    </svg>
  )
}

export function DatesIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="date-1" cx="30" cy="24" r="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92400E" />
          <stop offset="0.7" stopColor="#451A03" />
          <stop offset="1" stopColor="#290E02" />
        </radialGradient>
        <radialGradient id="date-2" cx="42" cy="38" r="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A16207" />
          <stop offset="0.6" stopColor="#713F12" />
          <stop offset="1" stopColor="#3F2207" />
        </radialGradient>
        <radialGradient id="date-3" cx="22" cy="42" r="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#78350F" />
          <stop offset="0.7" stopColor="#451A03" />
          <stop offset="1" stopColor="#1E0A01" />
        </radialGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="32" cy="56" rx="20" ry="4" fill="#000000" fillOpacity="0.1" />
      {/* Date 1 (top) */}
      <ellipse cx="32" cy="25" rx="14" ry="10" transform="rotate(-15 32 25)" fill="url(#date-1)" />
      <path d="M26 21C28 19 32 19 35 22" stroke="#FEF3C7" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4" />
      {/* Date 2 (bottom left) */}
      <ellipse cx="23" cy="42" rx="13" ry="9" transform="rotate(25 23 42)" fill="url(#date-3)" />
      <path d="M18 39C20 37 23 38 25 40" stroke="#FEF3C7" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.35" />
      {/* Date 3 (bottom right) */}
      <ellipse cx="41" cy="40" rx="14" ry="10" transform="rotate(-20 41 40)" fill="url(#date-2)" />
      <path d="M37 36C39 34 43 34 45 37" stroke="#FEF3C7" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  )
}

export function AlmondsIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="almond-grad-1" x1="20" y1="20" x2="38" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" />
          <stop offset="0.7" stopColor="#B45309" />
          <stop offset="1" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="almond-grad-2" x1="32" y1="26" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="0.6" stopColor="#D97706" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="32" cy="56" rx="20" ry="3.5" fill="#000000" fillOpacity="0.08" />
      {/* Almond 1 */}
      <path
        d="M17 44C13 36 17 22 28 17C35 24 37 38 31 46C26 50 20 48 17 44Z"
        fill="url(#almond-grad-1)"
      />
      <path d="M23 23C27 28 28 35 25 43" stroke="#FEF3C7" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.3" />
      {/* Almond 2 */}
      <path
        d="M47 45C51 37 47 23 36 18C29 25 27 39 33 47C38 51 44 49 47 45Z"
        fill="url(#almond-grad-2)"
      />
      <path d="M41 24C37 29 36 36 39 44" stroke="#FEF3C7" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.3" />
      {/* Almond 3 (center front) */}
      <ellipse cx="32" cy="42" rx="10" ry="6.5" transform="rotate(5 32 42)" fill="#B45309" />
    </svg>
  )
}

export function PistachioIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="shell-grad" x1="22" y1="20" x2="42" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7" />
          <stop offset="0.6" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <radialGradient id="pista-nut" cx="32" cy="34" r="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#84CC16" />
          <stop offset="0.7" stopColor="#4D7C0F" />
          <stop offset="1" stopColor="#365314" />
        </radialGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="32" cy="56" rx="18" ry="3.5" fill="#000000" fillOpacity="0.08" />
      {/* Green Nut Inside */}
      <ellipse cx="32" cy="35" rx="8" ry="12" fill="url(#pista-nut)" />
      <path d="M30 30C32 28 34 31 35 34" stroke="#FEF08A" strokeWidth="1" strokeLinecap="round" />
      {/* Left Shell Half */}
      <path
        d="M32 20C22 21 16 30 18 42C19 49 26 53 32 50C28 44 26 32 32 20Z"
        fill="url(#shell-grad)"
        stroke="#D97706"
        strokeWidth="0.8"
      />
      {/* Right Shell Half */}
      <path
        d="M32 20C42 21 48 30 46 42C45 49 38 53 32 50C36 44 38 32 32 20Z"
        fill="url(#shell-grad)"
        stroke="#D97706"
        strokeWidth="0.8"
      />
    </svg>
  )
}

export function SpicesIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="32" cy="56" rx="18" ry="3.5" fill="#000000" fillOpacity="0.08" />
      {/* Spice Mound */}
      <path d="M16 44C16 32 24 24 32 24C40 24 48 32 48 44H16Z" fill="#B91C1C" />
      <circle cx="32" cy="32" r="6" fill="#DC2626" />
      <circle cx="26" cy="38" r="4" fill="#EA580C" />
      <circle cx="38" cy="38" r="4.5" fill="#991B1B" />
      {/* Wooden Spoon */}
      <path d="M20 52C28 48 40 46 48 44" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function BeverageIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="32" cy="58" rx="14" ry="3" fill="#000000" fillOpacity="0.08" />
      {/* Cap */}
      <rect x="28" y="8" width="8" height="5" rx="1.5" fill="#2563EB" />
      {/* Neck */}
      <rect x="29" y="13" width="6" height="8" fill="#93C5FD" fillOpacity="0.6" />
      {/* Bottle Body */}
      <path
        d="M24 21H40L43 28V54C43 56 41 58 39 58H25C23 58 21 56 21 54V28L24 21Z"
        fill="#3B82F6"
        fillOpacity="0.85"
      />
      <rect x="23" y="32" width="18" height="14" rx="2" fill="#FFFFFF" />
      <text x="32" y="41" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#1E40AF" fontFamily="system-ui, sans-serif">
        DRINK
      </text>
    </svg>
  )
}

export function DefaultProductIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <ellipse cx="32" cy="56" rx="16" ry="3.5" fill="#000000" fillOpacity="0.08" />
      {/* 3D Box */}
      <path d="M32 12L50 22V42L32 52L14 42V22L32 12Z" fill="#3B82F6" />
      <path d="M32 12L50 22L32 32L14 22L32 12Z" fill="#60A5FA" />
      <path d="M32 32V52L50 42V22L32 32Z" fill="#2563EB" />
      <path d="M14 22L32 32V52L14 42V22Z" fill="#1D4ED8" />
    </svg>
  )
}

export function ProductIllustration({
  name,
  category,
  className = "w-10 h-10"
}: {
  name: string
  category?: string
  className?: string
}) {
  const lower = (name + " " + (category || "")).toLowerCase()
  if (lower.includes("honey")) return <HoneyJarIcon className={className} />
  if (lower.includes("saffron") || lower.includes("kesar")) return <SaffronIcon className={className} />
  if (lower.includes("oil") || lower.includes("zaitoon") || lower.includes("forest")) return <OilBottleIcon className={className} />
  if (lower.includes("date") || lower.includes("ajwa") || lower.includes("toffee")) return <DatesIcon className={className} />
  if (lower.includes("almond") || lower.includes("badam")) return <AlmondsIcon className={className} />
  if (lower.includes("pistachio") || lower.includes("pista")) return <PistachioIcon className={className} />
  if (lower.includes("spice") || lower.includes("masala") || lower.includes("chilli") || lower.includes("pepper")) return <SpicesIcon className={className} />
  if (lower.includes("juice") || lower.includes("drink") || lower.includes("beverage") || lower.includes("bottle") || lower.includes("cold")) return <BeverageIcon className={className} />
  return <DefaultProductIcon className={className} />
}
