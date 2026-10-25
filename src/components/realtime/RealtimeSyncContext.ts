import { createContext } from "react"

export interface RealtimeSyncState {
  isConnected: boolean
  lastEventTime: Date | null
  refetchAll: () => void
}

const defaultRealtimeState: RealtimeSyncState = {
  isConnected: false,
  lastEventTime: null,
  refetchAll: () => {},
}

export const RealtimeSyncContext = createContext<RealtimeSyncState>(defaultRealtimeState)
