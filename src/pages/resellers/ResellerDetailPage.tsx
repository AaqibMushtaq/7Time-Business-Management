import { useParams, useNavigate, Link } from "react-router-dom"
import { ChevronRight, Users } from "lucide-react"
import ResellerDetailPanel from "@/components/resellers/ResellerDetailPanel"

export default function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-sm">Invalid person ID.</p>
        <button
          onClick={() => navigate("/local-customers")}
          className="mt-4 text-[#2563EB] underline text-sm"
        >
          Return to Personal Ledger
        </button>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-0">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs sm:text-sm text-[#52627A] py-2 border-b border-[#D9E0E8] mb-2 sm:mb-3"
      >
        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#2563EB] shrink-0" />
        <Link
          to="/local-customers"
          className="font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline transition-colors"
        >
          Personal Ledger
        </Link>
        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#D9E0E8] shrink-0" />
        <span className="font-semibold text-[#172B4D] truncate max-w-xs">
          Account Details
        </span>
      </nav>

      {/* Full-page detail panel — manages its own modals internally */}
      <ResellerDetailPanel
        id={id}
        onClose={() => navigate("/local-customers")}
      />
    </div>
  )
}
