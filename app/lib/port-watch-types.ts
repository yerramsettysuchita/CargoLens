// Shared types for IMF PortWatch data
// Kept separate so client components can import without pulling in next/server

export interface PortWatchEntry {
  portId:          string;
  portName:        string;
  waitingTimeDays: number;
  vesselCalls:     number;
  congestionScore: number;
  riskLevel:       "low" | "moderate" | "high" | "severe";
  observedDate:    string;
}

export interface PortCongestionAPIResponse {
  ports:     Record<string, PortWatchEntry>;
  source:    "imf_portwatch" | "unavailable";
  fetchedAt: string;
  count:     number;
  error?:    string;
}
