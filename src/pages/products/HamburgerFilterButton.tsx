import React from "react"

export interface HamburgerFilterButtonProps {
  isOpen: boolean
  onClick: () => void
  activeCount?: number
  isMobile?: boolean
  className?: string
  buttonRef?: React.RefObject<HTMLButtonElement | null>
}

/**
 * Reusable animated HamburgerFilterButton
 * Displays an animated 3-bar hamburger icon that transitions smoothly,
 * with active filter badges on mobile and desktop viewports.
 */
export const HamburgerFilterButton: React.FC<HamburgerFilterButtonProps> = ({
  isOpen,
  onClick,
  activeCount = 0,
  isMobile = false,
  className = "",
  buttonRef,
}) => {
  if (isMobile) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className={`sm:hidden w-10 h-10 rounded-xl bg-white border border-[#D9E0E8] shadow-xs flex items-center justify-center text-[#2563EB] hover:bg-blue-50 relative shrink-0 cursor-pointer transition-colors ${className}`}
        aria-label={isOpen ? "Close filters panel" : "Open filters panel"}
        aria-expanded={isOpen}
      >
        <div className="w-4 h-3 flex flex-col justify-between items-center relative" aria-hidden="true">
          <span
            className={`w-4 h-0.5 bg-[#2563EB] rounded-full transition-all duration-200 ease-in-out ${
              isOpen ? "rotate-45 translate-y-1.25" : ""
            }`}
          />
          <span
            className={`w-3 h-0.5 bg-[#2563EB] rounded-full self-start transition-all duration-150 ease-in-out ${
              isOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`w-4 h-0.5 bg-[#2563EB] rounded-full transition-all duration-200 ease-in-out ${
              isOpen ? "-rotate-45 -translate-y-1.25" : ""
            }`}
          />
        </div>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`hidden sm:flex h-10 px-3.5 rounded-xl border text-xs font-semibold items-center gap-2 shadow-xs cursor-pointer transition-colors ${
        isOpen || activeCount > 0
          ? "border-blue-400 bg-blue-50/70 text-blue-700"
          : "border-[#D9E0E8] bg-white text-slate-700 hover:bg-slate-50"
      } ${className}`}
      aria-expanded={isOpen}
    >
      <div className="w-3.5 h-2.5 flex flex-col justify-between items-center relative shrink-0" aria-hidden="true">
        <span
          className={`w-3.5 h-0.5 bg-current rounded-full transition-all duration-200 ease-in-out ${
            isOpen ? "rotate-45 translate-y-1" : ""
          }`}
        />
        <span
          className={`w-2.5 h-0.5 bg-current rounded-full self-start transition-all duration-150 ease-in-out ${
            isOpen ? "opacity-0" : ""
          }`}
        />
        <span
          className={`w-3.5 h-0.5 bg-current rounded-full transition-all duration-200 ease-in-out ${
            isOpen ? "-rotate-45 -translate-y-1" : ""
          }`}
        />
      </div>
      <span>Filters</span>
      {activeCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
          {activeCount}
        </span>
      )}
    </button>
  )
}
