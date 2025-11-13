const { contextBridge, ipcRenderer, desktopCapturer } = require('electron')

// Безопасно экспортируем API в React приложение
contextBridge.exposeInMainWorld('electronAPI', {
  // Desktop capture
  getDesktopSources: async (options) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 },
        fetchWindowIcons: true,
      })
      return sources
    } catch (error) {
      console.error('Error getting desktop sources:', error)
      throw error
    }
  },

  platform: process.platform,

  checkWindowAudioSupport: async () => {
    try {
      // Проверяем доступность API для захвата звука окон
      return process.platform === 'win32'
    } catch (error) {
      return false
    }
  },

  getWindowAudioInfo: async (sourceId) => {
    try {
      // Здесь можно добавить логику для получения дополнительной информации об окне
      return { hasAudio: true, sourceId }
    } catch (error) {
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
