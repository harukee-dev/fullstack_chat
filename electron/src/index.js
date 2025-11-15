// В main.js (main process Electron)
const {
  app,
  BrowserWindow,
  desktopCapturer,
  systemPreferences,
  ipcMain,
  session,
  webContents,
} = require('electron')

const path = require('path')
const { permission } = require('process')

app.commandLine.appendSwitch('enable-webrtc-audio-processing')
app.commandLine.appendSwitch('enable-features', 'WebRtcHideLocalIpsWithMdns')

let mainWindow

app.setAsDefaultProtocolClient('lynk')
app.setAppUserModelId('com.lynk.screenshare')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableBlinkFeatures: 'MediaDevices',
      webSecurity: false, // для разработки
      allowRunningInsecureContent: true, // для разработки
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Разрешения для захвата экрана
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowedPermissions = [
        'desktopCapture',
        'display-capture',
        'media',
        'camera',
        'microphone',
      ]

      if (allowedPermissions.includes(permission)) {
        console.log(`✅ Permission granted: ${permission}`)
        callback(true)
      } else {
        console.log(`❌ Permission denied: ${permission}`)
        callback(false)
      }
    }
  )

  // Разрешить проверку разрешений
  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      const allowedPermissions = [
        'desktopCapture',
        'display-capture',
        'media',
        'camera',
        'microphone',
      ]
      return allowedPermissions.includes(permission)
    }
  )

  mainWindow.webContents.openDevTools()
  mainWindow.loadURL('http://localhost:3000') // или ваш URL
}

// Запрос разрешений для macOS
app.whenReady().then(() => {
  // Запрос разрешений для macOS
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('screen').then((granted) => {
      console.log('Screen capture access:', granted)
    })

    // Дополнительные разрешения для звука
    systemPreferences.askForMediaAccess('microphone').then((granted) => {
      console.log('Microphone access:', granted)
    })
  }

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowedPermissions = [
        'audioCapture',
        'videoCapture',
        'desktopCapture',
        'media',
        'display-capture',
      ]
      if (allowedPermissions.includes(permission)) {
        callback(true)
      } else {
        callback(false)
      }
    }
  )

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      if (permission === 'display-capture' || permission === 'desktopCapture') {
        return true
      }
      return false
    }
  )

  createWindow()
})

// Обработчик для получения источников рабочего стола - ДОБАВЬТЕ ЭТОТ ОБРАБОТЧИК
app.whenReady().then(() => {
  const { ipcMain } = require('electron')

  ipcMain.handle('get-desktop-sources', async (event, options) => {
    try {
      console.log('🖥️ Getting desktop sources with options:', options)

      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 200, height: 200 },
        fetchWindowIcons: true,
      })

      console.log(`✅ Found ${sources.length} desktop sources`)
      return sources
    } catch (error) {
      console.error('❌ Error getting desktop sources:', error)
      throw error
    }
  })

  // Явно установите разрешения для desktop capture
  ipcMain.handle('check-screen-capture-access', async () => {
    if (process.platform === 'darwin') {
      const hasAccess = systemPreferences.getMediaAccessStatus('screen')
      console.log('Screen capture access status:', hasAccess)
      return hasAccess === 'granted'
    }
    return true
  })

  // Добавьте обработчик для получения статуса медиа-доступа
  ipcMain.handle('get-media-access-status', async (event, mediaType) => {
    if (process.platform === 'darwin') {
      return systemPreferences.getMediaAccessStatus(mediaType)
    }
    return 'granted'
  })

  ipcMain.handle('can-capture-system-audio', async () => {
    const platform = process.platform
    return platform === 'win32' || platform === 'darwin'
  })
})
