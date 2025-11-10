export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}

export interface ElectronAPI {
  getDesktopSources: (options: { types: string[] }) => Promise<DesktopSource[]>
  platform: string
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  checkMediaPermissions: () => Promise<boolean>
  requestCameraPermission: () => Promise<boolean>
  requestMicrophonePermission: () => Promise<boolean>
  checkScreenCaptureAccess: () => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
