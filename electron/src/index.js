const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  systemPreferences,
} = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
    },
    show: false,
  })

  // DEVELOPMENT: React dev server

  mainWindow.loadURL('http://localhost:3000')
  mainWindow.webContents.openDevTools()

  // Показываем окно когда контент загружен
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()

    if (process.platform === 'darwin') {
      app.dock.show()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Логируем ошибки загрузки
  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription)
    }
  )
}

// Функция запроса разрешений
async function requestMediaPermissions() {
  try {
    // Запрашиваем разрешения для macOS
    if (process.platform === 'darwin') {
      // Проверяем текущий статус разрешений
      const cameraStatus = systemPreferences.getMediaAccessStatus('camera')
      const microphoneStatus =
        systemPreferences.getMediaAccessStatus('microphone')
      const screenStatus = systemPreferences.getMediaAccessStatus('screen')

      console.log('📷 Camera permission status:', cameraStatus)
      console.log('🎤 Microphone permission status:', microphoneStatus)
      console.log('🖥️ Screen recording permission status:', screenStatus)

      // Запрашиваем разрешения если они не предоставлены
      if (cameraStatus !== 'granted') {
        const cameraGranted =
          await systemPreferences.askForMediaAccess('camera')
        console.log('📷 Camera access granted:', cameraGranted)
      }

      if (microphoneStatus !== 'granted') {
        const microphoneGranted =
          await systemPreferences.askForMediaAccess('microphone')
        console.log('🎤 Microphone access granted:', microphoneGranted)
      }

      // Для записи экрана в macOS нужно специальное разрешение в настройках системы
      if (screenStatus !== 'granted') {
        console.warn('⚠️ Screen recording permission not granted!')
        console.log(
          '🔧 Please enable screen recording in System Preferences > Security & Privacy > Privacy > Screen Recording'
        )
      }
    }

    // Для Windows и Linux разрешения запрашиваются через браузерные API
  } catch (error) {
    console.error('❌ Error requesting media permissions:', error)
  }
}

// Инициализация приложения
app.whenReady().then(() => {
  createWindow()

  // Запрашиваем разрешения после создания окна
  requestMediaPermissions()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers для функциональности стримов
ipcMain.handle('GET_DESKTOP_SOURCES', async (event, options) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 },
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }))
  } catch (error) {
    console.error('Error getting desktop sources:', error)
    throw error
  }
})

// Обработчик для проверки статуса разрешений
ipcMain.handle('CHECK_MEDIA_PERMISSIONS', async () => {
  if (process.platform === 'darwin') {
    return {
      camera: systemPreferences.getMediaAccessStatus('camera'),
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      screen: systemPreferences.getMediaAccessStatus('screen'),
    }
  }

  // Для Windows и Linux возвращаем "granted" так как разрешения запрашиваются через браузер
  return {
    camera: 'granted',
    microphone: 'granted',
    screen: 'granted',
  }
})

// Дополнительные IPC handlers
ipcMain.handle('GET_APP_VERSION', () => {
  return app.getVersion()
})

ipcMain.handle('GET_PLATFORM', () => {
  return process.platform
})

// Обработчик для запроса разрешения камеры
ipcMain.handle('REQUEST_CAMERA_PERMISSION', async () => {
  if (process.platform === 'darwin') {
    return await systemPreferences.askForMediaAccess('camera')
  }
  return true
})

// Обработчик для запроса разрешения микрофона
ipcMain.handle('REQUEST_MICROPHONE_PERMISSION', async () => {
  if (process.platform === 'darwin') {
    return await systemPreferences.askForMediaAccess('microphone')
  }
  return true
})
