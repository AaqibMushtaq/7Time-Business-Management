import { useContext } from "react"
import { RealtimeSyncContext, type RealtimeSyncState } from "@/components/realtime/RealtimeSyncContext"

/**
 * useRealtimeSync
 * Consumes the managed Supabase Realtime synchronization state.
 */
export function useRealtimeSync(): RealtimeSyncState {
  return useContext(RealtimeSyncContext)
}

export type { RealtimeSyncState }
