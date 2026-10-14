import { useParams, useNavigate } from "react-router-dom"
import ResellerDetailPanel from "@/components/resellers/ResellerDetailPanel"

export default function ResellerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return <div className="p-8 text-center text-slate-500">Invalid customer ID</div>
  }

  return (
    <div className="w-full">
      <ResellerDetailPanel
        id={id}
        onClose={() => navigate("/resellers")}
        onRecordPayment={() => {}}
      />
    </div>
  )
}
