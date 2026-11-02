import { useMemo } from "react"
import type { ManagedUserAccount } from "@/types/auth"
import { AccountListItem } from "./AccountListItem"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
} from "lucide-react"

interface AccountDirectoryProps {
  users: ManagedUserAccount[]
  selectedUserId: string | null
  currentUserId?: string
  onSelectUser: (user: ManagedUserAccount) => void
  isLoading: boolean
  searchTerm: string
  onSearchChange: (val: string) => void
  statusFilter: "ALL" | "ACTIVE" | "SUSPENDED"
  onStatusFilterChange: (val: "ALL" | "ACTIVE" | "SUSPENDED") => void
  roleFilter: "ALL" | "SUPER_ADMIN" | "USER"
  onRoleFilterChange: (val: "ALL" | "SUPER_ADMIN" | "USER") => void
  sortBy: "NEWEST" | "OLDEST" | "NAME_ASC" | "NAME_DESC"
  onSortChange: (val: "NEWEST" | "OLDEST" | "NAME_ASC" | "NAME_DESC") => void
  page: number
  onPageChange: (newPage: number) => void
  pageSize?: number
}

export function AccountDirectory({
  users,
  selectedUserId,
  currentUserId,
  onSelectUser,
  isLoading,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
  sortBy,
  onSortChange,
  page,
  onPageChange,
  pageSize = 8,
}: AccountDirectoryProps) {
  // 1. Filter
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchName = (u.full_name || "").toLowerCase().includes(query)
        const matchEmail = (u.email || "").toLowerCase().includes(query)
        const matchPhone = (u.phone || "").toLowerCase().includes(query)
        if (!matchName && !matchEmail && !matchPhone) return false
      }

      // Status filter
      if (statusFilter === "ACTIVE" && !u.is_active) return false
      if (statusFilter === "SUSPENDED" && u.is_active) return false

      // Role filter
      if (roleFilter === "SUPER_ADMIN" && u.system_role !== "SUPER_ADMIN") return false
      if (roleFilter === "USER" && u.system_role === "SUPER_ADMIN") return false

      return true
    })
  }, [users, searchTerm, statusFilter, roleFilter])

  // 2. Sort
  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers]
    list.sort((a, b) => {
      if (sortBy === "NEWEST") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
      if (sortBy === "OLDEST") {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      }
      if (sortBy === "NAME_ASC") {
        const nameA = (a.full_name || a.email).toLowerCase()
        const nameB = (b.full_name || b.email).toLowerCase()
        return nameA.localeCompare(nameB)
      }
      if (sortBy === "NAME_DESC") {
        const nameA = (a.full_name || a.email).toLowerCase()
        const nameB = (b.full_name || b.email).toLowerCase()
        return nameB.localeCompare(nameA)
      }
      return 0
    })
    return list
  }, [filteredUsers, sortBy])

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedUsers.slice(start, start + pageSize)
  }, [sortedUsers, currentPage, pageSize])

  const hasActiveFilters =
    searchTerm.trim() !== "" || statusFilter !== "ALL" || roleFilter !== "ALL"

  const handleClearFilters = () => {
    onSearchChange("")
    onStatusFilterChange("ALL")
    onRoleFilterChange("ALL")
    onPageChange(1)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              User Accounts
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {filteredUsers.length}
            </span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search accounts by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value)
              onPageChange(1)
            }}
            className="pl-9 pr-8 text-xs rounded-xl h-9 bg-slate-50 border-slate-200 focus:bg-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("")
                onPageChange(1)
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value as any)
                onPageChange(1)
              }}
              aria-label="Filter accounts by active status"
              className="w-full text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Status: All</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => {
                onRoleFilterChange(e.target.value as any)
                onPageChange(1)
              }}
              aria-label="Filter accounts by system role"
              className="w-full text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Role: All</option>
              <option value="SUPER_ADMIN">Super Admins</option>
              <option value="USER">Standard Users</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              aria-label="Sort user accounts directory"
              className="w-full text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="NAME_ASC">Name (A–Z)</option>
              <option value="NAME_DESC">Name (Z–A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Account List Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[320px] max-h-[580px]">
        {isLoading && (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 animate-pulse flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-28 h-4 bg-slate-200 rounded" />
                  <div className="w-40 h-3 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && paginatedUsers.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">No accounts found</h3>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              {hasActiveFilters
                ? "No user accounts match the current filter criteria."
                : "No managed accounts registered in this organization."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="mt-2 text-xs rounded-xl h-8"
              >
                Reset Filters
              </Button>
            )}
          </div>
        )}

        {!isLoading &&
          paginatedUsers.map((user) => (
            <AccountListItem
              key={user.id}
              user={user}
              isSelected={user.id === selectedUserId}
              isCurrentUser={user.id === currentUserId}
              onSelect={onSelectUser}
            />
          ))}
      </div>

      {/* Pagination Footer */}
      {!isLoading && sortedUsers.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] font-medium">
            Showing{" "}
            <strong className="text-slate-800">
              {(currentPage - 1) * pageSize + 1}
            </strong>
            –
            <strong className="text-slate-800">
              {Math.min(currentPage * pageSize, sortedUsers.length)}
            </strong>{" "}
            of <strong className="text-slate-800">{sortedUsers.length}</strong>
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="h-7 w-7 p-0 rounded-lg cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <span className="px-2 text-[11px] font-bold text-slate-700">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="h-7 w-7 p-0 rounded-lg cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

