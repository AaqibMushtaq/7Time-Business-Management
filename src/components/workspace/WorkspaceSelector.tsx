import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/components/auth/useAuth"
import type { Workspace } from "@/types/auth"
import { Briefcase, User, ChevronDown, Check, Layers } from "lucide-react"

interface WorkspaceSelectorProps {
  variant?: "header" | "sidebar"
}

export function WorkspaceSelector({ variant = "header" }: WorkspaceSelectorProps) {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!workspaces || workspaces.length === 0) {
    return null
  }

  const handleSelectWorkspace = (ws: Workspace) => {
    setCurrentWorkspace(ws)
    setIsOpen(false)
  }

  const activeWs = currentWorkspace || workspaces[0]
  const hasMultiple = workspaces.length > 1

  const getWorkspaceIcon = (type: string) => {
    if (type === "BUSINESS") return <Briefcase className="h-3.5 w-3.5 text-blue-600 shrink-0" />
    return <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
  }

  const getWorkspaceBadgeClass = (type: string) => {
    if (type === "BUSINESS") return "bg-blue-50 text-blue-700 border-blue-200"
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }

  // Single workspace display (informative badge)
  if (!hasMultiple) {
    if (variant === "sidebar") {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          {getWorkspaceIcon(activeWs.workspace_type)}
          <span className="font-semibold text-slate-800 truncate flex-1">{activeWs.name}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase border ${getWorkspaceBadgeClass(activeWs.workspace_type)}`}>
            {activeWs.workspace_type === "BUSINESS" ? "Biz" : "Pers"}
          </span>
        </div>
      )
    }

    return (
      <div 
        className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 shadow-2xs"
        title={`Active Workspace: ${activeWs.name}`}
      >
        {getWorkspaceIcon(activeWs.workspace_type)}
        <span className="font-semibold text-slate-800 truncate max-w-[140px]">{activeWs.name}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${getWorkspaceBadgeClass(activeWs.workspace_type)}`}>
          {activeWs.workspace_type === "BUSINESS" ? "Business" : "Personal"}
        </span>
      </div>
    )
  }

  // Multi-workspace interactive switcher
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Switch active workspace"
        className={`
          flex items-center gap-2 rounded-xl transition-all cursor-pointer font-medium text-xs
          focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden
          ${variant === "sidebar" 
            ? "w-full justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800" 
            : "px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs text-slate-700 hover:text-slate-900"
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
            {getWorkspaceIcon(activeWs.workspace_type)}
          </div>
          <div className="text-left min-w-0">
            <span className="font-bold text-slate-900 block truncate max-w-[130px] leading-tight">
              {activeWs.name}
            </span>
            <span className="text-[10px] text-slate-500 block leading-tight font-medium">
              {activeWs.workspace_type === "BUSINESS" ? "Business Workspace" : "Personal Workspace"}
            </span>
          </div>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          role="listbox"
          aria-label="Available workspaces"
          className={`
            absolute z-50 mt-1.5 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150
            ${variant === "sidebar" ? "left-0 bottom-full mb-1.5" : "left-0 top-full"}
          `}
        >
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Switch Workspace
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              {workspaces.length} available
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWs.id
              return (
                <button
                  key={ws.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectWorkspace(ws)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-xs text-left transition-colors cursor-pointer
                    ${isSelected ? "bg-blue-50/80 font-bold text-blue-900" : "hover:bg-slate-50 text-slate-700 font-medium"}
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                      {getWorkspaceIcon(ws.workspace_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-slate-900">{ws.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {ws.workspace_type === "BUSINESS" ? "Commercial Business" : "Private Personal"}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

