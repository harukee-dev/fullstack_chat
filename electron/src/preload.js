const { contextBridge, ipcRenderer, desktopCapturer } = require('electron')

// Безопасно экспортируем API в React приложение
contextBridge.exposeInMainWorld('electronAPI', {
  // Desktop capture
  getDesktopSources: (options) => {
    return ipcRenderer.invoke('get-desktop-sources', options)
  },

  platform: process.platform,

  checkWindowAudioSupport: async () => {
    try {
      return process.platform === 'win32'
    } catch (error) {
      console.error('Error checking window audio support:', error)
      return false
    }
  },

  getWindowAudioInfo: async (sourceId) => {
    try {
      return { hasAudio: true, sourceId }
    } catch (error) {
      console.error('Error getting window audio info:', error)
      return { hasAudio: false, sourceId }
    }
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('GET_APP_VERSION'),
  getPlatform: () => process.platform,

  // Permissions
  checkMediaPermissions: () => ipcRenderer.invoke('CHECK_MEDIA_PERMISSIONS'),
  requestCameraPermission: () =>
    ipcRenderer.invoke('REQUEST_CAMERA_PERMISSION'),
  requestMicrophonePermission: () =>
    ipcRenderer.invoke('REQUEST_MICROPHONE_PERMISSION'),

  // Screen capture access
  checkScreenCaptureAccess: () => {
    if (process.platform === 'darwin') {
      return ipcRenderer.invoke('check-screen-capture-access')
    }
    return Promise.resolve(true)
  },
  canCaptureSystemAudio: () => {
    const platform = process.platform
    return platform === 'win32' || platform === 'darwin'
  },
  getMediaAccessStatus: (mediaType) => {
    if (process.platform === 'darwin') {
      return ipcRenderer.invoke('get-media-access-status', mediaType)
    }
    return Promise.resolve('granted') // Assume granted for non-macOS
  },
})

console.log('✅ Preload script loaded successfully')
