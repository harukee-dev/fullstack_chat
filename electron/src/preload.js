const { contextBridge, ipcRenderer } = require('electron')

// Безопасно экспортируем API в React приложение
contextBridge.exposeInMainWorld('electronAPI', {
  // Desktop capture
  getDesktopSources: (options) =>
    ipcRenderer.invoke('GET_DESKTOP_SOURCES', options),

  // App info
  getAppVersion: () => ipcRenderer.invoke('GET_APP_VERSION'),
  getPlatform: () => ipcRenderer.invoke('GET_PLATFORM'),

  // Permissions
  checkMediaPermissions: () => ipcRenderer.invoke('CHECK_MEDIA_PERMISSIONS'),
  requestCameraPermission: () =>
    ipcRenderer.invoke('REQUEST_CAMERA_PERMISSION'),
  requestMicrophonePermission: () =>
    ipcRenderer.invoke('REQUEST_MICROPHONE_PERMISSION'),

  // Platform info
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development',
})

console.log('✅ Preload script loaded successfully')
