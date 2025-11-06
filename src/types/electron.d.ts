export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  display_id?: string
}

export interface ElectronAPI {
  getDesktopSources: (options: { types: string[] }) => Promise<DesktopSource[]>
  platform: string
  isDev: boolean
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
