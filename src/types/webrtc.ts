export interface PeerUserInfo {
  userId: string
  avatar: string
  username: string
}

export interface UseWebRTCReturn {
  clients: string[]
  provideMediaRef: (clientId: string, instance: HTMLVideoElement | null) => void
  isSpeaking: boolean
  setThresholdDb: (threshold: number) => void
  thresholdDb: number
  peerUserInfo: Record<string, PeerUserInfo>
}
