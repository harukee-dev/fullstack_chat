// Импорты
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMediaSoup } from '../../hooks/useMediaSoup'
import { useSocket } from '../../SocketContext'
import cl from './room.module.css'
import leaveSound from './sounds/leave-sound.mp3'
import joinSound from './sounds/join-sound.mp3'
import mutedIcon from './images/muted-microphone-icon.png'
import { AnimatePresence, motion } from 'framer-motion'
import { useAudioVolume, useAudioControl } from './roomUtils'
import React from 'react'
import { useAppSelector } from '../../store'
import closeStreamIcon from './images/close-stream-icon.png'
import { CallInteraction } from '../CallInteraction/CallInteraction'
import { IFocus } from './roomTypes'
import {
  isElectron,
  canCaptureSystemAudio,
  checkSystemAudioSupport,
  checkScreenShareSupport,
  checkWindowAudioSupport,
  getWindowAudioInfo,
} from './electronHelpers'
import { DesktopSource } from '../../types/electron'

// Интерфейс для данных о потребителе медиа
export interface ConsumerData {
  consumer: any // объект Consumer - получает медиа от других пользователей
  kind: string // тип медиа - 'audio'/'video'
  userId: string // ID пользователя
  username?: string // ник пользователя от которого мы получаем медиа
  avatar?: string // аватарка пользователя от которого мы получаем медиа
  isScreenShare: boolean
}

export interface ProducerData {
  producerId: string
  kind: string
  userId: string
  username?: string
  avatar?: string
  appData?: { isScreenShare: boolean }
}

// Интерфейс для производителей медиа - то есть для отправки медиа серверу
export interface Producers {
  [key: string]: any
  audio?: any // есть ли аудио в нашем медиа
  video?: any // есть ли видео в нашем медиа
}

// Интерфейс для хранения всех потребителей
export interface Consumers {
  [producerId: string]: ConsumerData // ключ - айди продюсера, значение - данные о консюмере
}

interface ElectronMediaStreamConstraints extends MediaStreamConstraints {
  audio?: any
  video?: any
}

export const Room = () => {
  const currentUserId = localStorage.getItem('user-id') // текущий айди локального пользователя
  const currentUsername = localStorage.getItem('username')
  const currentUserAvatar = localStorage.getItem('avatar')
  const { id: roomId } = useParams() // айди комнаты звонка
  const [isMicroMuted, setIsMicroMuted] = useState<boolean>(false) // замучен ли микрофон
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false) // включена ли камера
  const [localStream, setLocalStream] = useState<MediaStream | null>(null) // локальный стрим (звук и/или видео)
  const [sendTransport, setSendTransport] = useState<any>(null) // транспорт для отправки медиа
  const [producers, setProducers] = useState<Producers>({}) // объект с нашими продюсерами
  const [consumers, setConsumers] = useState<Consumers>({}) // объект с консюмерами других пользователей
  const [isConnected, setIsConnected] = useState<boolean>(false) // статус подключения к звонку
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0) // колво попыток переподключения к звонку
  const navigate = useNavigate() // функция навигации на нужный адрес
  const [isVideoCall, setIsVideoCall] = useState<boolean>(false)
  const [openedScreens, setOpenedScreens] = useState<string[]>([])

  const [focus, setFocus] = useState<IFocus | null>(null)

  useEffect(() => {
    console.log('FOCUS:', focus)
  }, [focus])

  const joinSoundRef = useRef<HTMLAudioElement | null>(null)
  const leaveSoundRef = useRef<HTMLAudioElement | null>(null)

  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false) // включена ли демка
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null) // стрим демки
  const [screenProducer, setScreenProducer] = useState<any>(null) // продюсер для передачи демки

  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())

  const { noise, echo, autoGain, threshold } = useAppSelector(
    (state) => state.voiceSettings
  )

  const [desktopSources, setDesktopSources] = useState<DesktopSource[]>([])
  const [showSourceSelector, setShowSourceSelector] = useState<boolean>(false)
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(
    null
  )

  // инициализация звуков входа и выхода (и предварительная загрузка сразу, чтобы они срабатывали без задержки)
  useEffect(() => {
    joinSoundRef.current = new Audio(joinSound)
    leaveSoundRef.current = new Audio(leaveSound)

    joinSoundRef.current.load()
    leaveSoundRef.current.load()
  }, [])

  useEffect(() => {
    const checkElectronAPI = () => {
      if (!window.electronAPI) {
        console.error('❌ Electron API not available')
        alert(
          'Electron API недоступен. Убедитесь что приложение запущено в Electron.'
        )
        return false
      }
      return true
    }

    // Проверяем при монтировании
    checkElectronAPI()
  }, [])

  const { socket } = useSocket() // получаем сокет из контекста
  const {
    device, // объект нашего девайса (ноута, телефона, компа и тд)
    isDeviceInitialized, // инициализировано ли устройство
    isLoading, // идет ли загрузка
    error, // ошибки если есть
    createTransports, // функция создания транспортов
    createConsumer, // функция создания консюмера
    closeTransports, // функция закрытия транспортов
    fullRetry, // функция полного переподключения
    reconnectAttempts: mediaSoupAttempts,
  } = useMediaSoup(roomId || '', isMicroMuted, isCameraOn)

  const producersRef = useRef<Producers>({}) // ссылка на объект продюсеров (для быстрого доступа)
  const isInitializedRef = useRef(false) // флаг инициализации (избегаем повторной инициализации)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null) // ссылка на таймер переподключения
  const userIdRef = useRef<string>(socket?.id || '') // ID юзера (socket.id)
  const recvTransportRef = useRef<any>(null) // транспорт для получения медиа (receive transport)

  // сохранение ссылки на айди текущего сокета
  useEffect(() => {
    userIdRef.current = socket?.id || ''
  }, [socket])

  // при входе или изменении сокета запрашиваем список замученных пользователей, чтобы при входе в звонок сразу вывести, кто замучен
  useEffect(() => {
    socket?.emit('get-muted-users', roomId)
  }, [socket])

  // отправление сокета о том, что мы замутились или размутились
  useEffect(() => {
    if (isMicroMuted) {
      socket?.emit('user-muted', { userId: currentUserId, roomId: roomId })
    } else {
      socket?.emit('user-unmuted', { userId: currentUserId, roomId: roomId })
    }
  }, [isMicroMuted, socket, currentUserId, roomId])

  // обработка сигналов о том, что кто-то замутился или размутился, и обработка сигнала со списком замученных пользователей
  useEffect(() => {
    socket?.on('user-muted', (mutedUsersArray: string[]) => {
      setMutedUsers(new Set(mutedUsersArray))
    })
    socket?.on('user-unmuted', (mutedUsersArray: string[]) => {
      setMutedUsers(new Set(mutedUsersArray))
    })
    socket?.on('get-muted-users', (mutedUsersArray: string[]) => {
      setMutedUsers(new Set(mutedUsersArray))
    })
  }, [socket])

  // Функция получения медиа потока
  const getMediaStream = useCallback(
    async (isCameraOn: boolean) => {
      try {
        const streams: MediaStream[] = []

        // Всегда получаем аудио с микрофона
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false, // только аудио
        })
        streams.push(audioStream)

        // Если включена камера - добавляем видео
        if (isCameraOn) {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false, // только видео
            video: {
              width: 1280,
              height: 720,
              frameRate: 30,
            },
          })
          streams.push(cameraStream)
        }

        // Объединяем все треки в один MediaStream
        const combinedStream = new MediaStream()

        streams.forEach((stream) => {
          stream.getTracks().forEach((track) => {
            combinedStream.addTrack(track)
          })
        })

        return combinedStream
      } catch (error) {
        console.error('Ошибка при получении медиаданных:', error)
        return null
      }
    },
    [echo, noise, autoGain]
  )

  // Создание Producer - объекта, который отправляет медиа данные на сервер
  // Создание Producer - объекта, который отправляет медиа данные на сервер
  const createProducer = useCallback(
    async (transport: any, stream: MediaStream, kind: string) => {
      // проверка, что транспорт и стрим инициализированы
      if (!transport || !stream) {
        console.error('ERR: !transport || !stream for', kind)
        return null
      }

      try {
        // получаем соответствующие треки
        const tracks =
          kind === 'audio' || kind === 'screenAudio'
            ? stream.getAudioTracks()
            : stream.getVideoTracks()

        console.log(`🔍 Checking tracks for ${kind}:`, {
          tracksCount: tracks.length,
          tracks: tracks.map((t) => ({
            id: t.id,
            kind: t.kind,
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
          })),
        })

        if (tracks.length === 0) {
          console.error('ERR: no tracks for', kind)
          return null
        }

        const track = tracks[0]

        if (track.readyState !== 'live') {
          console.error('Track is not live:', kind, track.readyState)
          return null
        }

        // Определяем ключ для producer
        const producerKey = kind

        // если такой продюсер уже существует, то закрываем старый
        if (producersRef.current[producerKey]) {
          console.log(`🔄 Closing existing ${producerKey} producer`)
          producersRef.current[producerKey].close()
          producersRef.current[producerKey] = null
        }

        // Определяем isScreenShare для разных типов продюсеров
        const isScreenShare = kind === 'screen' || kind === 'screenAudio'

        const appData = {
          isScreenShare,
          userId: currentUserId,
          username: currentUsername,
          avatar: currentUserAvatar,
        }

        console.log(`🎯 Creating ${kind} producer with appData:`, appData)

        // создаем новый продюсер
        const producer = await transport.produce({
          track,
          appData,
        })

        console.log(`✅ ${kind} producer created successfully:`, producer.id)

        producersRef.current[producerKey] = producer

        // Сохраняем в соответствующем state
        if (kind === 'screen' || kind === 'screenAudio') {
          setScreenProducer(producer)
          console.log(`📝 Set screenProducer for ${kind}:`, producer.id)
        } else {
          setProducers((prev) => ({ ...prev, [kind]: producer }))
        }

        // Обработчики событий продюсера
        producer.on('transportclose', () => {
          console.log(`🚪 ${kind} producer transport closed`)
          producersRef.current[producerKey] = null
          if (kind === 'screen' || kind === 'screenAudio') {
            setScreenProducer(null)
          } else {
            setProducers((prev) => ({ ...prev, [kind]: undefined }))
          }
        })

        producer.on('trackended', () => {
          console.log(`⏹️ ${kind} producer track ended`)
          producersRef.current[producerKey] = null
          if (kind === 'screen' || kind === 'screenAudio') {
            setScreenProducer(null)
          } else {
            setProducers((prev) => ({ ...prev, [kind]: undefined }))
          }
        })

        return producer
      } catch (error) {
        console.error(`❌ Ошибка при создании ${kind} Producer:`, error)
        return null
      }
    },
    [socket, roomId, currentUserId, currentUsername, currentUserAvatar]
  )

  // ! ЗДЕСЬ СДЕЛАЕМ ДЕМКУ

  const getScreenStream = useCallback(async (): Promise<MediaStream | null> => {
    // Проверяем, что electronAPI доступен
    if (!window.electronAPI) {
      console.error('❌ Electron API is not available')
      alert('Electron API не доступен. Проверьте настройки приложения.')
      return null
    }

    try {
      console.log('🖥️ Requesting desktop sources from Electron...')

      // Добавляем обработку ошибок с таймаутом
      const sourcesPromise = window.electronAPI.getDesktopSources({
        types: ['window', 'screen'],
      })

      // Таймаут для запроса источников
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Timeout getting desktop sources')),
          10000
        )
      })

      const sources = await Promise.race([sourcesPromise, timeoutPromise])

      //@ts-ignore
      if (!sources || sources.length === 0) {
        console.error('❌ No desktop sources available')
        alert(
          'Не удалось найти доступные источники для демонстрации экрана. Проверьте разрешения системы.'
        )
        return null
      }

      //@ts-ignore
      console.log('✅ Desktop sources received:', sources.length)
      //@ts-ignore
      setDesktopSources(sources)
      setShowSourceSelector(true)

      // Возвращаем null - ждем выбора пользователя
      return null
    } catch (error: any) {
      console.error('❌ Error getting desktop sources:', error)

      let errorMessage =
        'Ошибка при получении списка источников для демонстрации'

      if (error.message.includes('Timeout')) {
        errorMessage = 'Таймаут при получении источников. Попробуйте еще раз.'
      } else if (
        error.message.includes('permission') ||
        error.message.includes('denied')
      ) {
        errorMessage =
          'Доступ к захвату экрана запрещен. Проверьте разрешения системы.'
      }

      alert(errorMessage)
      return null
    }
  }, [])

  const startElectronScreenShareSafe = async (
    source: DesktopSource
  ): Promise<MediaStream | null> => {
    try {
      console.log('🎯 Starting Electron screen share with source:', source.name)

      const hasAccess = await checkScreenShareSupport()
      if (!hasAccess) {
        alert('Нет доступа к захвату экрана. Проверьте разрешения системы.')
        return null
      }

      return await startScreenShareWithoutAudio(source)
    } catch (error: any) {
      console.error('❌ Screen share failed:', error)

      let errorMessage = 'Не удалось начать демонстрацию экрана.'
      if (error.name === 'NotAllowedError') {
        errorMessage =
          'Доступ к захвату экрана запрещен. Проверьте разрешения системы.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Не удалось найти источник для демонстрации.'
      }

      alert(errorMessage)
      return null
    }
  }

  const startScreenShareWithoutAudio = async (
    source: DesktopSource
  ): Promise<MediaStream | null> => {
    try {
      console.log(
        '🖥️ Starting screen share WITHOUT audio (Windows optimization)'
      )

      // ТОЛЬКО видео, без системного звука
      const videoConstraints: ElectronMediaStreamConstraints = {
        audio: false, // Явно отключаем звук для экрана
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            width: 1920,
            height: 1080,
            maxFrameRate: 30,
          },
        },
      }

      const stream = await (navigator.mediaDevices as any).getUserMedia(
        videoConstraints
      )

      console.log('✅ Screen share (video only) created successfully:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      })

      // Обработчики окончания треков
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        track.onended = () => {
          console.log(`Track ${track.kind} ended`)
          stopScreenShare()
        }
      })

      return stream
    } catch (error) {
      console.error('❌ Error in screen share without audio:', error)
      return null
    }
  }

  const startWindowShareWithAudio = async (
    source: DesktopSource
  ): Promise<MediaStream | null> => {
    try {
      console.log(
        '🪟 Starting window share WITH isolated window audio (Windows)'
      )

      const platform = window.electronAPI?.platform || process.platform

      if (platform !== 'win32') {
        console.log('❌ Window audio capture only supported on Windows')
        return await startWindowShareWithoutAudio(source)
      }

      // На Windows используем специальные constraints для захвата звука конкретного окна
      const constraintsWithIsolatedAudio: ElectronMediaStreamConstraints = {
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            // Дополнительные параметры для изоляции звука окна
            ...(platform === 'win32' && {
              // Windows-specific параметры для изоляции звука
              allowAudio: true,
              audioCapture: 'window', // Указываем что хотим захватывать звук окна
            }),
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            width: 1920,
            height: 1080,
            maxFrameRate: 30,
            cursor: 'always',
          },
        },
      }

      // Альтернативные варианты constraints для разных версий Windows/Electron
      const constraintsVariants = [
        // Вариант 1: Полная конфигурация с изоляцией звука
        constraintsWithIsolatedAudio,

        // Вариант 2: Упрощенная конфигурация (для старых версий)
        {
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              width: 1920,
              height: 1080,
              maxFrameRate: 30,
              cursor: 'always',
            },
          },
        },

        // Вариант 3: Fallback без звука
        {
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              width: 1920,
              height: 1080,
              maxFrameRate: 30,
              cursor: 'always',
            },
          },
        },
      ]

      let lastError: any = null

      for (let i = 0; i < constraintsVariants.length; i++) {
        try {
          console.log(`🔄 Trying window audio variant ${i + 1}...`)

          const stream = await (navigator.mediaDevices as any).getUserMedia(
            constraintsVariants[i]
          )

          const audioTracks = stream.getAudioTracks()
          const videoTracks = stream.getVideoTracks()

          console.log(`✅ Window share variant ${i + 1} successful:`, {
            audioTracks: audioTracks.length,
            videoTracks: videoTracks.length,
          })

          if (audioTracks.length > 0) {
            console.log('🔊 Window audio captured successfully')

            // Добавляем обработчики для аудио треков
            audioTracks.forEach((track: any, index: any) => {
              console.log(`🎵 Audio track ${index}:`, {
                id: track.id,
                label: track.label,
                kind: track.kind,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
              })

              track.onended = () => {
                console.log(`Audio track ${track.id} ended`)
                stopScreenShare()
              }
            })
          } else {
            console.log('🔇 No audio available for this window')
          }

          // Обработчики для видео треков
          videoTracks.forEach((track: MediaStreamTrack) => {
            track.onended = () => {
              console.log(`Video track ${track.kind} ended`)
              stopScreenShare()
            }
          })

          return stream
        } catch (error) {
          lastError = error
          console.log(`❌ Window audio variant ${i + 1} failed:`, error)

          if (i === constraintsVariants.length - 1) {
            throw error
          }
        }
      }

      throw lastError
    } catch (error) {
      console.error('❌ Error in window share with audio:', error)

      // Fallback: пробуем без звука
      try {
        console.log('🔄 Falling back to window share without audio...')
        return await startWindowShareWithoutAudio(source)
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
        return null
      }
    }
  }

  const startWindowShareWithoutAudio = async (
    source: DesktopSource
  ): Promise<MediaStream | null> => {
    try {
      console.log('🪟 Starting window share WITHOUT audio')

      const constraintsWithoutAudio: ElectronMediaStreamConstraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            width: 1920,
            height: 1080,
            maxFrameRate: 30,
            cursor: 'always',
          },
        },
      }

      const stream = await (navigator.mediaDevices as any).getUserMedia(
        constraintsWithoutAudio
      )

      console.log('✅ Window share without audio successful:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      })

      stream.getTracks().forEach((track: MediaStreamTrack) => {
        track.onended = () => {
          console.log(`Track ${track.kind} ended`)
          stopScreenShare()
        }
      })

      return stream
    } catch (error) {
      console.error('❌ Error in window share without audio:', error)
      return null
    }
  }

  const checkAndRequestPermissions = async (): Promise<boolean> => {
    if (!isElectron()) return true

    try {
      console.log('🔐 Checking screen capture permissions...')

      // Проверяем доступ к захвату экрана
      const hasScreenAccess = await checkScreenShareSupport()

      if (!hasScreenAccess) {
        console.log('❌ No screen capture access')

        // На macOS можно показать инструкцию
        if (window.electronAPI?.platform === 'darwin') {
          alert(
            'Для демонстрации экрана необходимо предоставить разрешение. ' +
              'Откройте Системные настройки > Защита и безопасность > Конфиденциальность > Запись экрана ' +
              'и разрешите приложению записывать экран.'
          )
        }

        return false
      }

      console.log('✅ Screen capture permissions granted')
      return true
    } catch (error) {
      console.error('Error checking permissions:', error)
      return false
    }
  }

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      console.log('🖥️ Screen share already active')
      return
    }

    try {
      console.log('🖥️ Starting screen share...')

      // Проверяем разрешения перед началом
      const hasPermissions = await checkAndRequestPermissions()
      if (!hasPermissions) {
        setIsScreenSharing(false)
        return
      }

      const stream = await getScreenStream()
      // Дальнейшая логика остается без изменений
    } catch (error) {
      console.error('❌ Error starting screen share:', error)
      setIsScreenSharing(false)
    }
  }, [getScreenStream, isScreenSharing])

  const stopScreenShare = useCallback(() => {
    console.log('🖥️ Stopping screen share...')

    // Закрываем селектор если открыт
    setShowSourceSelector(false)
    setSelectedSource(null)

    // Останавливаем screen stream
    if (screenStream) {
      console.log('🛑 Stopping screen stream tracks...')
      screenStream.getTracks().forEach((track) => {
        console.log(`🛑 Stopping track: ${track.kind} - ${track.id}`)
        track.stop()
      })
      setScreenStream(null)
    }

    // Закрываем screen producers
    if (producersRef.current.screen) {
      console.log(
        '🖥️ Closing screen video producer:',
        producersRef.current.screen.id
      )
      if (socket && roomId) {
        socket.emit('producer-close', {
          producerId: producersRef.current.screen.id,
          roomId,
          appData: { isScreenShare: true },
        })
      }
      producersRef.current.screen.close()
      producersRef.current.screen = null
      setScreenProducer(null)
    }

    if (producersRef.current.screenAudio) {
      console.log(
        '🔊 Closing screen audio producer:',
        producersRef.current.screenAudio.id
      )
      if (socket && roomId) {
        socket.emit('producer-close', {
          producerId: producersRef.current.screenAudio.id,
          roomId,
          appData: { isScreenShare: true },
        })
      }
      producersRef.current.screenAudio.close()
      producersRef.current.screenAudio = null
    } else {
      console.log('❌ No screen audio producer found to close')
    }

    setIsScreenSharing(false)
    console.log('✅ Screen share stopped completely')
  }, [screenStream, socket, roomId])

  const SourceSelector = () => {
    const [windowAudioSupported, setWindowAudioSupported] =
      useState<boolean>(false)
    const [audioInfo, setAudioInfo] = useState<Record<string, any>>({})

    useEffect(() => {
      const checkAudioSupport = async () => {
        const supported = await checkWindowAudioSupport()
        setWindowAudioSupported(supported)

        // Предзагружаем информацию об аудио для каждого источника
        const info: Record<string, any> = {}
        for (const source of desktopSources) {
          const audioInfo = await getWindowAudioInfo(source.id)
          info[source.id] = audioInfo
        }
        setAudioInfo(info)
      }
      checkAudioSupport()
    }, [desktopSources])

    if (!showSourceSelector) return null

    const handleSourceSelect = async (source: DesktopSource) => {
      console.log('🎯 User selected source:', source.name)
      setSelectedSource(source)
      setShowSourceSelector(false)

      try {
        console.log('🔄 Starting screen share with selected source...')
        const stream = await startElectronScreenShareSafe(source)

        if (stream) {
          console.log('✅ Screen stream obtained successfully from selection')

          const audioTracks = stream.getAudioTracks()
          const videoTracks = stream.getVideoTracks()
          console.log(`🎵 Audio tracks: ${audioTracks.length}`)
          console.log(`🎥 Video tracks: ${videoTracks.length}`)

          if (audioTracks.length > 0) {
            console.log('🔊 Audio is being captured')
          } else {
            console.log('🔇 Audio is not available')
          }

          setScreenStream(stream)
          setIsScreenSharing(true)
        } else {
          console.error('❌ Failed to get screen stream from selected source')
          setIsScreenSharing(false)
        }
      } catch (error) {
        console.error(
          '❌ Error starting screen share with selected source:',
          error
        )
        setIsScreenSharing(false)
      }
    }

    const handleCancel = () => {
      console.log('❌ User cancelled screen share')
      setShowSourceSelector(false)
      setSelectedSource(null)
    }

    const screens = desktopSources.filter(
      (source) =>
        source.name.toLowerCase().includes('screen') ||
        source.name === 'Entire Screen' ||
        source.name.startsWith('Screen ')
    )

    const windows = desktopSources.filter((source) => !screens.includes(source))

    return (
      <div className={cl.sourceSelectorOverlay}>
        <div className={cl.sourceSelector}>
          <h3>Выберите что показать</h3>

          <div className={cl.audioInfo}>
            <div className={cl.audioCapabilities}>
              <h4>Возможности звука:</h4>
              <ul>
                <li>
                  • <strong>Экраны:</strong> 🔇 Без системного звука (избегаем
                  эха)
                </li>
                <li>
                  • <strong>Окна:</strong>{' '}
                  {windowAudioSupported ? '🔊 Звук этого окна' : '🔇 Без звука'}
                  {windowAudioSupported && <small>(изолированный звук)</small>}
                </li>
              </ul>
            </div>
          </div>

          {screens.length > 0 && (
            <div className={cl.sourceGroup}>
              <h4>Экраны</h4>
              <div className={cl.sourceList}>
                {screens.map((source) => (
                  <button
                    key={source.id}
                    className={cl.sourceItem}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className={cl.sourceThumbnail}
                    />
                    <span className={cl.sourceName}>{source.name}</span>
                    <div className={cl.sourceBadge}>
                      Экран 🔇
                      <small>(без звука)</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {windows.length > 0 && (
            <div className={cl.sourceGroup}>
              <h4>Окна приложений</h4>
              <div className={cl.sourceList}>
                {windows.map((source) => (
                  <button
                    key={source.id}
                    className={cl.sourceItem}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className={cl.sourceThumbnail}
                    />
                    <span className={cl.sourceName}>
                      {source.name.length > 30
                        ? source.name.substring(0, 30) + '...'
                        : source.name}
                    </span>
                    <div className={cl.sourceBadge}>
                      Окно {windowAudioSupported ? '🔊' : '🔇'}
                      <small>
                        {windowAudioSupported
                          ? '(звук этого окна)'
                          : '(без звука)'}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={cl.sourceSelectorActions}>
            <button onClick={handleCancel} className={cl.cancelButton}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      startScreenShare()
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  // Обработка создания screen producer при получении screenStream
  useEffect(() => {
    const createScreenProducer = async () => {
      if (!screenStream || !sendTransport || !isConnected) {
        console.log(
          '❌ Cannot create screen producer - missing requirements:',
          {
            screenStream: !!screenStream,
            sendTransport: !!sendTransport,
            isConnected,
          }
        )
        return
      }

      try {
        console.log('🖥️ Creating screen producers...')

        // Детальная информация о screenStream
        const audioTracks = screenStream.getAudioTracks()
        const videoTracks = screenStream.getVideoTracks()

        console.log('📊 Screen stream analysis:', {
          audioTracks: audioTracks.length,
          videoTracks: videoTracks.length,
          audioTrackDetails: audioTracks.map((track) => ({
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          })),
          videoTrackDetails: videoTracks.map((track) => ({
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          })),
        })

        // Создаем видео продюсер для демки
        const screenVideoTrack = screenStream.getVideoTracks()[0]
        if (screenVideoTrack) {
          console.log('🎥 Creating screen video producer...')
          const videoStream = new MediaStream([screenVideoTrack])
          const videoProducer = await createProducer(
            sendTransport,
            videoStream,
            'screen'
          )
          if (videoProducer) {
            console.log(
              '✅ Screen video producer created successfully:',
              videoProducer.id
            )
          } else {
            console.log('❌ Failed to create screen video producer')
          }
        } else {
          console.log('❌ No screen video track available')
        }

        // Создаем аудио продюсер для системного звука
        const screenAudioTrack = screenStream.getAudioTracks()[0]
        if (screenAudioTrack) {
          console.log('🔊 Creating screen audio producer...')

          // Проверяем, что аудио трек активен
          if (screenAudioTrack.readyState === 'ended') {
            console.log('❌ Screen audio track has ended')
            return
          }

          const audioStream = new MediaStream([screenAudioTrack])
          const audioProducer = await createProducer(
            sendTransport,
            audioStream,
            'screenAudio'
          )

          if (audioProducer) {
            console.log(
              '✅ Screen audio producer created successfully:',
              audioProducer.id
            )

            // Проверяем, что продюсер действительно создался
            if (producersRef.current.screenAudio) {
              console.log('🎯 Screen audio producer confirmed in producersRef')
            } else {
              console.log('❌ Screen audio producer NOT found in producersRef')
            }
          } else {
            console.log('❌ Failed to create screen audio producer')
          }
        } else {
          console.log('❌ No screen audio track available')

          // Логируем дополнительную информацию для отладки
          console.log('🔍 All tracks in screenStream:', {
            tracks: screenStream.getTracks().map((t) => ({
              kind: t.kind,
              id: t.id,
              label: t.label,
              readyState: t.readyState,
              enabled: t.enabled,
            })),
          })
        }
      } catch (error) {
        console.error('❌ Error creating screen producers:', error)
      }
    }

    if (screenStream && isScreenSharing) {
      console.log('🚀 Triggering screen producer creation...')
      createScreenProducer()
    }
  }, [
    screenStream,
    sendTransport,
    isConnected,
    createProducer,
    isScreenSharing,
  ])

  const { isSpeaking } = useAudioVolume(localStream, threshold) // получаем динамическую переменную, говорит ли человек (в независимости от того, в муте он или нет)
  const { isTransmitting } = useAudioControl({
    isSpeaking,
    isMicroMuted,
    sendTransport,
    producersRef,
    isConnected,
    localStream,
    createProducer,
    socket,
    roomId,
  }) // получаем динамическую переменную, нужно ли отправлять звук (не замучен && говорит)
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set()) // Set юзеров, которые говорят на данный момент

  // useEffect-обработчик изменения isTransmitting
  useEffect(() => {
    if (isTransmitting)
      // если он true (то есть нужно отправлять звук)
      socket?.emit('user-speaking', {
        userId: currentUserId,
        roomId,
      })
    // сигнализируем сокет о том, что юзер заговорил
    else socket?.emit('user-silent', { userId: currentUserId, roomId }) // иначе если false (не нужно отправлять звук) - сигнализируем сокет о том, что юзер замолчал
  }, [socket, isTransmitting, currentUserId, roomId])

  // обработчик сигналов сокета о том, что кто-то заговорил или замолчал
  useEffect(() => {
    socket?.on('user-speaking', (userId) => {
      // @ts-ignore
      setSpeakingUsers((prev) => new Set([...prev, userId])) // когда юзер заговорил - добавляем его в Set говорящих на данный момент юзеров
    })

    socket?.on('user-silent', (userId) => {
      setSpeakingUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      }) // когда юзер замолчал - удаляем его из Set говорящих на данный момент юзеров
    })

    // cleanup обработчика
    return () => {
      socket?.off('user-speaking')
      socket?.off('user-silent')
    }
  }, [socket]) // в зависимостях только socket

  // Создание Consumer - объекта, который получает медиа данные от других пользователей
  // Создание Consumer - объекта, который получает медиа данные от других пользователей
  const handleCreateConsumer = useCallback(
    async (producerData: ProducerData) => {
      // проверка, что девайс и транспорт получения инициализированы
      if (!recvTransportRef.current || !device) {
        console.error(
          '❌ Cannot create consumer - missing recvTransport or device'
        )
        return null
      }

      try {
        console.log(
          `🔧 Creating ${producerData.kind} consumer for producer:`,
          producerData.producerId
        )

        const consumer = await createConsumer(
          producerData.producerId,
          //@ts-ignore
          device.rtpCapabilities
        )

        if (!consumer) {
          console.error('❌ Failed to create consumer')
          return null
        }

        console.log(`✅ ${producerData.kind} consumer created:`, consumer.id)

        // если консюмер с типом аудио и у него есть трек
        if (consumer.kind === 'audio' && consumer.track) {
          console.log('🎵 Setting up audio element for consumer:', consumer.id)

          const audioElement = document.createElement('audio')
          audioElement.srcObject = new MediaStream([consumer.track])
          audioElement.autoplay = true
          // @ts-ignore
          audioElement.playsInline = true
          audioElement.muted = false
          audioElement.style.display = 'none'

          // Для screen audio - изначально приостанавливаем, если экран не открыт
          const isScreenAudio = producerData.appData?.isScreenShare
          if (isScreenAudio) {
            const userId = producerData.userId
            const isScreenOpened = openedScreens.includes(userId)

            console.log('🖥️ Screen audio settings:', {
              userId,
              isScreenAudio,
              isScreenOpened,
              openedScreens,
            })

            if (!isScreenOpened) {
              audioElement.pause()
              audioElement.muted = true
              console.log(
                '🔇 Screen audio paused and muted (screen not opened)'
              )
            } else {
              console.log('🔊 Screen audio ready to play (screen opened)')
            }
          }

          audioElement.oncanplaythrough = () => {
            console.log(
              '🎧 Audio element ready to play for consumer:',
              consumer.id
            )
          }

          audioElement.onerror = (error) => {
            console.error(
              '❌ Audio element error for consumer:',
              consumer.id,
              error
            )
          }

          document.body.appendChild(audioElement)
          consumer.audioElement = audioElement

          // Функция воспроизведения с обработкой прерываний
          const playAudioWithRetry = async (retryCount = 0) => {
            try {
              await audioElement.play()
              console.log(
                '▶️ Audio playback started for consumer:',
                consumer.id
              )
            } catch (error: any) {
              if (error.name === 'AbortError') {
                return
              } else if (error.name === 'NotAllowedError') {
                console.log(
                  '⏸️ Audio play not allowed, will retry:',
                  consumer.id
                )
                return
              } else {
                console.error('❌ Audio play error:', error)
                if (retryCount < 3 && error.name !== 'AbortError') {
                  setTimeout(
                    () => playAudioWithRetry(retryCount + 1),
                    100 * (retryCount + 1)
                  )
                }
              }
            }
          }

          // Для screen audio воспроизводим только если экран открыт
          if (
            !producerData.appData?.isScreenShare ||
            openedScreens.includes(producerData.userId)
          ) {
            console.log('🚀 Starting audio playback for consumer:', consumer.id)
            playAudioWithRetry()
          } else {
            console.log('⏸️ Screen audio playback deferred (screen not opened)')
          }
        }

        return consumer
      } catch (error) {
        console.error('❌ Error in handleCreateConsumer:', error)
        return null
      }
    },
    [device, createConsumer, openedScreens]
  )

  // Базовая очистка при размонтировании
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current) // очизаем таймер переподключения
      }
    }
  }, [])

  // Обработка новых продюсеров (те, которые воспроизводят)
  useEffect(() => {
    if (!socket || !device) return // если сокет или девайс не инициализированы - прекращаем работу функции

    const handleNewProducer = async (data: ProducerData) => {
      // Пропускаем собственные продюсеры
      if (data.userId === userIdRef.current) {
        console.log('Skipping own producer:', data.producerId, data.kind)
        return
      }

      // Проверяем, не существует ли уже consumer с этим producerId
      if (consumers[data.producerId]) {
        console.log('Consumer already exists for producer:', data.producerId)
        return
      }

      console.log('🎯 Processing new producer:', {
        producerId: data.producerId,
        kind: data.kind,
        userId: data.userId,
        isScreenShare: data.appData?.isScreenShare,
        username: data.username,
      })

      // Для обычного аудио проверяем, нет ли уже аудио consumer от этого пользователя
      if (data.kind === 'audio' && !data.appData?.isScreenShare) {
        const existingAudioConsumer = Object.values(consumers).find(
          (consumerData) =>
            consumerData.userId === data.userId &&
            consumerData.kind === 'audio' &&
            !consumerData.isScreenShare
        )
        if (existingAudioConsumer) {
          console.log('Audio consumer already exists for user:', data.userId)
          return
        }
      }

      // Для аудио демки проверяем, нет ли уже аудио демки consumer от этого пользователя
      if (data.kind === 'audio' && data.appData?.isScreenShare) {
        const existingScreenAudioConsumer = Object.values(consumers).find(
          (consumerData) =>
            consumerData.userId === data.userId &&
            consumerData.kind === 'audio' &&
            consumerData.isScreenShare
        )
        if (existingScreenAudioConsumer) {
          console.log(
            'Screen audio consumer already exists for user:',
            data.userId
          )
          return
        }
      }

      try {
        console.log(
          '🎵 Creating consumer for producer:',
          data.producerId,
          data.kind,
          'from user:',
          data.userId,
          'isScreenShare:',
          data.appData?.isScreenShare
        )

        // Определяем isScreenShare
        const isScreenShare = data.appData?.isScreenShare || false

        // Создаём consumer
        const consumer = await handleCreateConsumer({
          ...data,
          kind: data.kind,
        })

        if (!consumer) {
          console.error(
            'Failed to create consumer for producer:',
            data.producerId
          )
          return
        }

        console.log('✅ Consumer created successfully:', consumer.id)

        // Обновляем consumers
        setConsumers((prev: any) => {
          // Если уже есть consumer с этим producerId — ничего не делаем
          if (prev[data.producerId]) return prev

          // Добавляем новый consumer
          return {
            ...prev,
            [data.producerId]: {
              consumer,
              kind: data.kind,
              userId: data.userId,
              username: data.username,
              avatar: data.avatar,
              isScreenShare: isScreenShare,
            },
          }
        })

        // Обработчики событий consumer
        consumer.on('transportclose', () => {
          console.log('Consumer transport closed:', data.producerId)
          // Безопасное удаление аудио элемента
          if (consumer.audioElement) {
            try {
              consumer.audioElement.pause()
              consumer.audioElement.srcObject = null
              consumer.audioElement.remove()
            } catch (error) {
              console.error('Error cleaning up audio element:', error)
            }
          }
          setConsumers((prev) => {
            const newConsumers = { ...prev }
            delete newConsumers[data.producerId]
            return newConsumers
          })
        })

        consumer.on('producerclose', () => {
          console.log('Consumer producer closed:', data.producerId)
          // Безопасное удаление аудио элемента
          if (consumer.audioElement) {
            try {
              consumer.audioElement.pause()
              consumer.audioElement.srcObject = null
              consumer.audioElement.remove()
            } catch (error) {
              console.error('Error cleaning up audio element:', error)
            }
          }
          setConsumers((prev) => {
            const newConsumers = { ...prev }
            delete newConsumers[data.producerId]
            return newConsumers
          })
        })

        console.log(
          '🎉 Successfully created and registered consumer for producer:',
          data.producerId
        )
      } catch (error) {
        console.error('Ошибка при создании consumer:', error)
      }
    }
    // функция обработчик закрытия продюсера (чужого)
    const handleProducerClose = (data: { producerId: string }) => {
      // обработчик закрытия продюсеров
      console.log('Producer closed:', data.producerId) // логирование того, что закрылся определнный продюсер
      setConsumers((prev) => {
        // изменяем массив консюмеров
        const newConsumers = { ...prev } // получаем все консюмеры
        if (newConsumers[data.producerId]) {
          // если в консюмерах есть ключ с айди нашего консюмера, который нужно закрыть
          if (
            newConsumers[data.producerId].consumer && // и в этом ключе есть сам консюмер
            !newConsumers[data.producerId].consumer.closed // и этот консюмер не закрыт
          ) {
            newConsumers[data.producerId].consumer.close() // то закрываем его
          }
          if (newConsumers[data.producerId].consumer?.audioElement) {
            // если внутри консюмера есть ссылка на аудио элемент
            newConsumers[data.producerId].consumer.audioElement.remove() // удаляем этот аудио элемент
          }
          delete newConsumers[data.producerId] // удаляем из массива консюмер с нужным айдишником
        }

        return newConsumers // возвращаем измененный массив
      })
    }

    // Получение существующих продюсеров
    // Получение существующих продюсеров
    const handleExistingProducers = async (producersList: ProducerData[]) => {
      console.log('Received existing producers:', producersList)

      for (const producer of producersList) {
        // Пропускаем если уже есть consumer
        if (consumers[producer.producerId]) continue

        if (producer.userId !== userIdRef.current) {
          // Добавляем isScreenShare если его нет

          await handleNewProducer(producer)
        }
      }
    }

    socket.on('new-producer', (data: ProducerData) => {
      handleNewProducer(data)
    }) // обработчик сокета о новом продюсере
    socket.on('producer-close', handleProducerClose) // обработчик сокета о закрытии продюсера
    socket.on('existing-producers', handleExistingProducers) // обработчик сокета о всех существующих продюсерах

    // Запрашиваем существующие продюсеры при подключении (только один раз)
    if (roomId && recvTransportRef.current) {
      // если мы находимся в руме и транспорт получения инициализирован
      console.log('Requesting existing producers for room:', roomId) // логируем то, что запрашиваем существующих продюсеров
      socket.emit('get-producers', roomId) // делаем запрос у сокета на существующих продюсеров
    }

    return () => {
      // cleanup обработчиков сокетов
      socket.off('new-producer', handleNewProducer)
      socket.off('producer-close', handleProducerClose)
      socket.off('existing-producers', handleExistingProducers)
    }
  }, [socket, device, consumers, roomId, handleCreateConsumer]) // зависимости

  // функция выхода из комнаты
  const leaveRoom = useCallback(async () => {
    console.log('Leaving room:', roomId) // логируем выход из комнаты

    if (socket && roomId) {
      // если сокет и айди комнаты инициализированы
      socket.emit('leave-room', { roomId }) // выводим сокету, что покидаем комнату с определенным айди
    }

    closeTransports() // закрываем все транспорты (как и для отправки, так и для получения)

    if (localStream) {
      // если локальный стрим инициализирован
      localStream.getTracks().forEach((track) => track.stop()) // закрываем все треки локального стрима
      setLocalStream(null) // обнуляем state локального стрима
    }

    // Закрываем producers
    Object.values(producersRef.current).forEach((producer) => {
      // проходимся по каждому продюсеру
      if (producer && typeof producer.close === 'function') {
        // если продюсер инициализирован и у него есть функция закрытия (второе для ts)
        producer.close() // то закрываем продюсер
      }
    })
    producersRef.current = {} // обнуляем массив продюсеров
    setProducers({}) // обнуляем state массив продюсеров

    if (producersRef.current.screenAudio) {
      producersRef.current.screenAudio.close()
      producersRef.current.screenAudio = null
    }

    // Закрываем консюмеры
    Object.values(consumers).forEach((consumerData) => {
      // проходимся по каждому консюмеру
      if (
        consumerData.consumer && // если консюмер инициализирован
        typeof consumerData.consumer.close === 'function' // и он имеет функцию закрытия
      ) {
        consumerData.consumer.close() // тогда закрываем этот консюмер
      }
      if (consumerData.consumer?.audioElement) {
        // если в консюмере сохранена ссылка на аудиоэлемент
        consumerData.consumer.audioElement.remove() // то удаляем этот элемент из DOM
      }
    })
    setConsumers({}) // обнуляем state массива консюмеров

    setIsConnected(false) // меняем статус подключения на false
    isInitializedRef.current = false // сбрасываем флаг инициализации
    // воспроизведение звука выхода
    if (leaveSoundRef.current) {
      if (!leaveSoundRef.current.paused) {
        leaveSoundRef.current.pause()
      }

      leaveSoundRef.current.currentTime = 0
      leaveSoundRef.current.play()
    }
    navigate('/test')
  }, [socket, roomId, localStream, consumers, closeTransports]) // прописываем зависимости

  // // Логирование Socket событий
  // useEffect(() => {
  //   if (!socket) return // проверка на инициализацию сокета

  //   const originalEmit = socket.emit // перехватываем socket.emit для логирования исходящих событий
  //   socket.emit = function (...args) {
  //     // логируем входящие события
  //     console.log('📤 SOCKET EMIT:', args[0], args[1])
  //     return originalEmit.apply(this, args)
  //   }

  //   const logEvent = (eventName: string, data: any) => {
  //     console.log('📥 SOCKET EVENT:', eventName, data)
  //   }

  //   socket.on('new-producer', (data) => logEvent('new-producer', data))
  //   socket.on('existing-producers', (data) =>
  //     logEvent('existing-producers', data)
  //   )
  //   socket.on('producer-close', (data) => logEvent('producer-close', data))

  //   return () => {
  //     // восстанавливаем оригинальный emit при cleanup
  //     socket.emit = originalEmit
  //     socket.off('new-producer')
  //     socket.off('existing-producers')
  //     socket.off('producer-close')
  //   }
  // }, [socket]) // настраиваем зависимости

  // Основная логика подключения (инициализации)
  useEffect(() => {
    const initializeRoom = async () => {
      if (!isDeviceInitialized || !roomId || isInitializedRef.current) {
        return
      }

      try {
        console.log('Step 1: Initializing room...')
        isInitializedRef.current = true

        console.log('Step 2: Creating transports...')
        const { sendTransport, recvTransport } = await createTransports()

        if (!sendTransport || !recvTransport) {
          throw new Error('Failed to create transports')
        }

        setSendTransport(sendTransport)
        recvTransportRef.current = recvTransport
        console.log('Step 3: Transports created successfully')

        console.log('Step 4: Getting media stream...')
        // Получаем ТОЛЬКО аудио (камера будет добавлена позже если нужно)
        const stream = await getMediaStream(false) // начинаем с выключенной камерой
        if (!stream) {
          throw new Error('Failed to get media stream')
        }

        setLocalStream(stream)
        console.log('Step 5: Media stream obtained')

        console.log('Step 6: Creating audio producer...')
        // Создаем только аудио продюсер
        await createProducer(sendTransport, stream, 'audio')

        setIsConnected(true)
        setReconnectAttempts(0)
        console.log('✅ Room initialization completed successfully')

        socket?.emit('joined-to-room', roomId)
      } catch (error) {
        console.error('❌ Room initialization failed:', error)
        isInitializedRef.current = false
        setReconnectAttempts((prev) => prev + 1)

        if (reconnectAttempts < 3) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000)
          reconnectTimeoutRef.current = setTimeout(() => {
            initializeRoom()
          }, delay)
        }
      }
    }

    initializeRoom()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [
    isDeviceInitialized,
    roomId,
    createTransports,
    getMediaStream,
    reconnectAttempts,
  ]) // УБИРАЕМ isCameraOn из зависимостей

  useEffect(() => {
    const manageScreenAudio = () => {
      Object.values(consumers).forEach((consumerData) => {
        // Находим screen audio consumer'ов
        if (
          consumerData.kind === 'audio' &&
          consumerData.isScreenShare &&
          consumerData.consumer?.audioElement
        ) {
          const audioElement = consumerData.consumer.audioElement
          const userId = consumerData.userId

          // Проверяем, открыт ли экран этого пользователя
          const isScreenOpened = openedScreens.includes(userId)

          if (isScreenOpened) {
            // Если экран открыт - воспроизводим звук
            if (audioElement.paused) {
              audioElement.play().catch((error: any) => {
                if (error.name !== 'AbortError') {
                  console.error('Error playing screen audio:', error)
                }
              })
            }
            audioElement.muted = false
          } else {
            // Если экран закрыт - приостанавливаем и мутируем звук
            audioElement.pause()
            audioElement.muted = true
          }
        }
      })
    }

    manageScreenAudio()
  }, [openedScreens, consumers])

  // Базовая очистка при размонтировании
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      // Останавливаем screen stream при размонтировании
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [screenStream])

  // Обработка изменений state микрофона и камеры
  const isUpdatingMediaRef = useRef(false)

  useEffect(() => {
    // воспроизведение звука входа, когда кто-то вошел в комнату (в том числе мы)
    socket?.on('joined-to-room', () => {
      if (joinSoundRef.current) {
        if (!joinSoundRef.current.paused) {
          joinSoundRef.current.pause()
        }

        joinSoundRef.current.currentTime = 0
        joinSoundRef.current.play()
      }
    })

    return () => {
      socket?.off('joined-to-room')
    }
  }, [])
  useEffect(() => {
    // воспроизведение звука выхода, когда кто-то вышел из комнаты
    socket?.on('leave-from-room', () => {
      if (leaveSoundRef.current) {
        if (!leaveSoundRef.current.paused) {
          leaveSoundRef.current.pause()
        }

        leaveSoundRef.current.currentTime = 0
        leaveSoundRef.current.play()
      }
    })

    return () => {
      socket?.off('leave-from-room')
    }
  }, [])

  // обработка изменения состояния камеры
  const updateMediaStream = useCallback(
    async (cameraOn: boolean, screenOn: boolean) => {
      try {
        // Создаем новый стрим
        const newStream = await getMediaStream(cameraOn)
        // проверяем что стрим создался корректно
        if (!newStream) {
          throw new Error('Failed to get media stream')
        }

        // Останавливаем старый стрим если есть
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            if (track.readyState === 'live') {
              track.stop()
            }
          })
        }

        setLocalStream(newStream) // сохраняем новый стрим в состоянии текущего стрима

        return newStream // возвращаем новый стрим
      } catch (error) {
        console.error('❌ Error updating media stream:', error)
        return null
      }
    },
    [localStream, getMediaStream]
  )

  // обработка изменения состояния камеры и демонстрации экрана

  // обработка изменения состояния камеры (УБИРАЕМ screenSharing из зависимостей)
  // обработка изменения состояния камеры
  useEffect(() => {
    const updateMedia = async () => {
      if (!sendTransport || !isConnected || isUpdatingMediaRef.current) {
        return
      }

      isUpdatingMediaRef.current = true

      try {
        console.log('🔄 Updating main media stream...')
        // Получаем ТОЛЬКО аудио и камеру (без screen)
        const newStream = await getMediaStream(isCameraOn)
        if (!newStream) {
          throw new Error('Failed to get media stream')
        }

        // останавливаем старый стрим, если он есть
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            if (track.readyState === 'live') {
              track.stop()
            }
          })
        }

        // сохраняем новый стрим
        setLocalStream(newStream)

        // Получаем все треки из нового стрима
        const audioTracks = newStream.getAudioTracks()
        const videoTracks = newStream.getVideoTracks()

        // Создаем/обновляем аудио продюсер (всегда должен быть)
        if (audioTracks.length > 0) {
          if (!producersRef.current.audio) {
            await createProducer(
              sendTransport,
              new MediaStream([audioTracks[0]]),
              'audio'
            )
          } else {
            // Обновляем существующий аудио трек если нужно
            console.log('Audio producer already exists')
          }
        }

        // Логика для камеры - ВСЕГДА создаем/обновляем если камера включена
        const cameraVideoTrack = videoTracks.find(
          (track) => track.kind === 'video'
        )

        if (isCameraOn && cameraVideoTrack) {
          if (!producersRef.current.video) {
            console.log('🎥 Creating video producer...')
            await createProducer(
              sendTransport,
              new MediaStream([cameraVideoTrack]),
              'video'
            )
            console.log('✅ Video producer created')
          } else {
            console.log('🎥 Video producer already exists')
          }
        } else if (!isCameraOn && producersRef.current.video) {
          console.log('🎥 Closing video producer (camera off)')
          if (socket) {
            socket.emit('producer-close', {
              producerId: producersRef.current.video.id,
              roomId,
              appData: { isScreenShare: false },
            })
          }
          producersRef.current.video.close()
          producersRef.current.video = null
          setProducers((prev) => ({ ...prev, video: undefined }))
        }
      } catch (error) {
        console.error('❌ Error in updateMedia:', error)
      } finally {
        isUpdatingMediaRef.current = false
      }
    }

    const timeoutId = setTimeout(() => {
      updateMedia()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [
    isCameraOn,
    sendTransport,
    isConnected,
    createProducer,
    socket,
    roomId,
    getMediaStream,
  ])

  // Фукнция полного переподключения
  const handleFullRetry = useCallback(async () => {
    isInitializedRef.current = false // выставляем, что комната не инициализирована

    // очищаем таймер переподключения, если он сейчас активен
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // закрываем и очищаем транспоррты
    closeTransports()
    setSendTransport(null)
    recvTransportRef.current = null

    if (localStream) {
      // закрываем все треки локального стрима
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    if (producersRef.current.screenAudio) {
      producersRef.current.screenAudio.close()
      producersRef.current.screenAudio = null
    }

    // закрываем все продюсеры
    Object.values(producersRef.current).forEach((producer) => {
      if (producer && typeof producer.close === 'function') {
        producer.close()
      }
    })
    producersRef.current = {}
    setProducers({})

    // закрываем все консюмеры
    Object.values(consumers).forEach((consumerData) => {
      if (
        consumerData.consumer &&
        typeof consumerData.consumer.close === 'function'
      ) {
        consumerData.consumer.close()
      }
      if (consumerData.consumer?.audioElement) {
        consumerData.consumer.audioElement.remove() // также при закрытии консюмеров удаляем аудио элементы, привязанные к ним
      }
    })
    setConsumers({})

    setReconnectAttempts(0) // обнуляем количество попыток переподключения
    setIsConnected(false) // выставляем, что мы не подключены

    fullRetry() // вызываем функцию полной повторной попытки подключения (50 строка)
  }, [sendTransport, localStream, closeTransports, fullRetry, consumers]) // зависимости

  const hasOtherUsersVideo = useMemo(
    () =>
      Object.values(consumers).some(
        (consumerData) => consumerData.kind === 'video'
      ),
    [consumers]
  )

  useEffect(() => {
    setIsVideoCall(isCameraOn || hasOtherUsersVideo || isScreenSharing)
  }, [isCameraOn, hasOtherUsersVideo, isScreenSharing])

  // Мемоизированная отрисовка
  const videoElements = useMemo(() => {
    // Группируем consumers по userId
    const consumersByUser = Object.values(consumers).reduce(
      (acc, consumerData) => {
        if (!acc[consumerData.userId]) {
          acc[consumerData.userId] = []
        }
        acc[consumerData.userId].push(consumerData)
        return acc
      },
      {} as Record<string, ConsumerData[]>
    )

    // Создаем элементы для каждого пользователя
    const elements = []

    for (const [userId, userConsumers] of Object.entries(consumersByUser)) {
      const audioConsumer = userConsumers.find((c) => c.kind === 'audio')
      const videoConsumer = userConsumers.find(
        (c) => c.kind === 'video' && !c.isScreenShare
      )
      const screenConsumer = userConsumers.find(
        (c) => c.kind === 'video' && c.isScreenShare
      )

      const isMuted = mutedUsers.has(userId)
      const isSpeaking = speakingUsers.has(userId)
      const userData = userConsumers[0]

      // 1. Сначала добавляем демонстрацию экрана (если есть) - ОТДЕЛЬНО
      if (screenConsumer && screenConsumer.consumer?.track) {
        elements.push(
          <div
            key={`screen-${screenConsumer.consumer.id}`}
            onClick={() =>
              isVideoCall && setFocus({ userId, isScreenShare: true })
            }
            style={isVideoCall ? { cursor: 'pointer' } : {}}
          >
            <ScreenShareElement
              key={`screen-${screenConsumer.consumer.id}`}
              consumerData={screenConsumer}
              openedScreens={openedScreens}
              setOpenedScreens={setOpenedScreens}
              setFocus={setFocus}
              isVideoCall={isVideoCall}
            />
          </div>
        )
      }

      // 2. Затем добавляем веб-камеру или аватар (если нет вебки)
      if (videoConsumer && videoConsumer.consumer?.track) {
        // Если есть вебка - показываем ее
        elements.push(
          <div
            key={`video-${videoConsumer.consumer.id}`}
            onClick={() =>
              isVideoCall && setFocus({ userId, isScreenShare: false })
            }
            style={isVideoCall ? { cursor: 'pointer' } : {}}
          >
            <UserVideoElement
              consumerData={videoConsumer}
              isMuted={isMuted}
              isSpeaking={isSpeaking}
              isVideoCall={isVideoCall}
            />
          </div>
        )
      } else if (audioConsumer && audioConsumer.consumer?.track) {
        // Если нет вебки, но есть аудио - показываем аватар
        elements.push(
          <div
            key={`audio-${audioConsumer.consumer.id}`}
            onClick={() =>
              isVideoCall && setFocus({ userId, isScreenShare: false })
            }
            style={isVideoCall ? { cursor: 'pointer' } : {}}
          >
            <audio
              ref={(audioElement) => {
                if (audioElement && audioConsumer.consumer.track) {
                  audioElement.srcObject = new MediaStream([
                    audioConsumer.consumer.track,
                  ])
                  audioElement.play().catch((error) => {
                    if (error.name !== 'AbortError') {
                      console.error('Error playing audio:', error)
                    }
                  })
                }
              }}
              autoPlay
              playsInline
              muted={false}
              style={{ display: 'none' }}
            />
            {isVideoCall || isScreenSharing ? (
              <div className={cl.avatarContainer}>
                <AnimatePresence>
                  {isSpeaking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className={cl.boxWave1} />
                      <div className={cl.boxWave2} />
                      <div className={cl.boxWave3} />
                      <div className={cl.boxWave4} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div
                  className={
                    isSpeaking
                      ? cl.boxAvatarContainerActive
                      : cl.boxAvatarContainer
                  }
                >
                  <img
                    draggable={false}
                    src={userData.avatar || '/default-avatar.png'}
                    alt={userData.username || 'user'}
                    className={cl.boxAvatarBackground}
                  />
                  <img
                    draggable={false}
                    src={userData.avatar || '/default-avatar.png'}
                    alt={userData.username || 'user'}
                    className={
                      isSpeaking
                        ? cl.boxAvatarImageActive
                        : isMuted
                        ? cl.boxAvatarImageMuted
                        : cl.boxAvatarImage
                    }
                  />
                  <AnimatePresence>
                    {isMuted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0.5 }}
                        transition={{ duration: 0.25 }}
                        className={cl.mutedIconWrapperBox}
                      >
                        <img
                          draggable={false}
                          className={cl.mutedIcon}
                          src={mutedIcon}
                          alt="muted"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className={cl.avatarContainer}>
                <AnimatePresence>
                  {isSpeaking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className={cl.wave1} />
                      <div className={cl.wave2} />
                      <div className={cl.wave3} />
                      <div className={cl.wave4} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <img
                  draggable={false}
                  src={userData.avatar || '/default-avatar.png'}
                  alt={userData.username || 'User'}
                  className={isSpeaking ? cl.avatarActive : cl.avatar}
                />
                <AnimatePresence>
                  {isMuted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0.5 }}
                      transition={{ duration: 0.25 }}
                      className={cl.mutedIconWrapper}
                    >
                      <img
                        draggable={false}
                        className={cl.mutedIcon}
                        src={mutedIcon}
                        alt="muted"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )
      }
    }

    return elements
  }, [
    consumers,
    mutedUsers,
    speakingUsers,
    isVideoCall,
    openedScreens,
    isScreenSharing,
    setFocus, // Добавляем setFocus в зависимости
  ])

  const localVideoElement = useMemo(() => {
    if (!localStream) return null

    const currentUserAvatar = localStorage.getItem('avatar')
    const isMuted = mutedUsers.has(currentUserId || 'userid')

    const handleLocalClick = () => {
      if (isVideoCall) {
        setFocus({ userId: currentUserId || '', isScreenShare: false })
      }
    }

    if (!isCameraOn) {
      return (
        <div
          onClick={handleLocalClick}
          style={isVideoCall ? { cursor: 'pointer' } : {}}
        >
          {isVideoCall || isScreenSharing ? (
            <div className={cl.avatarContainer}>
              <AnimatePresence>
                {isTransmitting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={cl.boxWave1} />
                    <div className={cl.boxWave2} />
                    <div className={cl.boxWave3} />
                    <div className={cl.boxWave4} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className={
                  isTransmitting
                    ? cl.boxAvatarContainerActive
                    : cl.boxAvatarContainer
                }
              >
                <img
                  draggable={false}
                  src={currentUserAvatar || '/default-avatar.png'}
                  alt={'you'}
                  className={cl.boxAvatarBackground}
                />
                <img
                  draggable={false}
                  src={currentUserAvatar || '/default-avatar.png'}
                  alt={'you'}
                  className={
                    isTransmitting
                      ? cl.boxAvatarImageActive
                      : isMicroMuted
                      ? cl.boxAvatarImageMuted
                      : cl.boxAvatarImage
                  }
                />
                <AnimatePresence>
                  {isMuted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0.5 }}
                      transition={{ duration: 0.25 }}
                      className={cl.mutedIconWrapperBox}
                    >
                      <img
                        draggable={false}
                        className={cl.mutedIcon}
                        src={mutedIcon}
                        alt="muted"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div>
              <div className={cl.avatarContainer}>
                <AnimatePresence>
                  {isTransmitting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className={cl.wave1} />
                      <div className={cl.wave2} />
                      <div className={cl.wave3} />
                      <div className={cl.wave4} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <img
                  draggable={false}
                  src={currentUserAvatar || '/default-avatar.png'}
                  alt={'you'}
                  className={isTransmitting ? cl.avatarActive : cl.avatar}
                />
              </div>
              <AnimatePresence>
                {isMuted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0.5 }}
                    transition={{ duration: 0.25 }}
                    className={cl.mutedIconWrapper}
                  >
                    <img
                      draggable={false}
                      className={cl.mutedIcon}
                      src={mutedIcon}
                      alt="muted"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div
          onClick={handleLocalClick}
          style={isVideoCall ? { cursor: 'pointer' } : {}}
        >
          <LocalVideoElement
            localStream={localStream}
            isTransmitting={isTransmitting}
            isMuted={isMuted}
          />
        </div>
      )
    }
  }, [
    localStream,
    isCameraOn,
    isTransmitting,
    mutedUsers,
    isVideoCall,
    isMicroMuted,
    currentUserId,
    isScreenSharing,
    setFocus, // Добавляем setFocus в зависимости
  ])
  // Отрисовка всего компонента
  return (
    <div className={cl.roomContainer}>
      <SourceSelector />
      {focus ? (
        <div className={cl.focusModeContainer}>
          <div
            className={cl.focusElementWrapper}
            onClick={() => setFocus(null)}
          >
            <FocusElement
              focus={focus}
              localStream={localStream}
              localScreenShare={screenStream}
              consumers={consumers}
              isCameraOn={isCameraOn}
              isScreenSharing={isScreenSharing}
              isTransmitting={isTransmitting}
              isMicroMuted={isMicroMuted}
              mutedUsers={mutedUsers}
              speakingUsers={speakingUsers}
            />
          </div>
          <UnfocusElements
            focus={focus}
            localStream={localStream}
            localScreenShare={screenStream}
            consumers={consumers}
            isCameraOn={isCameraOn}
            isScreenSharing={isScreenSharing}
            isTransmitting={isTransmitting}
            isMicroMuted={isMicroMuted}
            mutedUsers={mutedUsers}
            speakingUsers={speakingUsers}
            isVideoCall={isVideoCall}
            setFocus={setFocus}
          />
        </div>
      ) : (
        <div className={cl.usersContainer}>
          {localVideoElement}
          {videoElements}
          <LocalScreenShareElement
            screenStream={screenStream}
            isScreenSharing={isScreenSharing}
            setFocus={setFocus}
            isVideoCall={isVideoCall}
          />
        </div>
      )}

      <CallInteraction
        setIsCamera={setIsCameraOn}
        isCamera={isCameraOn}
        isMuted={isMicroMuted}
        setIsMuted={setIsMicroMuted}
        toggleStream={toggleScreenShare}
        isStream={isScreenSharing}
        leaveRoom={leaveRoom}
      />
      <div className={cl.backgroundLight} />
    </div>
  )
}

const UserVideoElement = React.memo(
  ({
    consumerData,
    isMuted,
    isSpeaking,
    isVideoCall,
    isFocus = false,
    isUnfocus = false,
  }: {
    consumerData: ConsumerData
    isMuted: boolean
    isSpeaking: boolean
    isVideoCall: boolean
    isFocus?: boolean
    isUnfocus?: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const trackRef = useRef<MediaStreamTrack | null>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      const track = consumerData.consumer?.track

      if (!videoElement || !track) return
      if (trackRef.current === track) return

      trackRef.current = track

      if (videoElement.srcObject) {
        const currentStream = videoElement.srcObject as MediaStream
        const currentTracks = currentStream.getTracks()
        if (currentTracks.length === 1 && currentTracks[0].id === track.id) {
          return
        }
        currentTracks.forEach((t) => t.stop())
      }

      const newStream = new MediaStream([track])
      videoElement.srcObject = newStream

      videoElement.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error playing video:', error)
        }
      })
    }, [consumerData.consumer?.track])

    const videoClass = isFocus
      ? isSpeaking
        ? cl.focusVideoActive
        : cl.focusVideo
      : isUnfocus
      ? isSpeaking
        ? cl.unfocusVideoActive
        : cl.unfocusVideo
      : isSpeaking
      ? cl.cameraActive
      : cl.camera

    const containerClass = isFocus
      ? cl.focusVideoContainer
      : isUnfocus
      ? cl.unfocusVideoContainer
      : cl.avatarContainer

    return (
      <div className={containerClass}>
        {!isFocus && !isUnfocus && (
          <AnimatePresence>
            {isSpeaking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cl.boxWave1} />
                <div className={cl.boxWave2} />
                <div className={cl.boxWave3} />
                <div className={cl.boxWave4} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          className={videoClass}
        />
        <AnimatePresence>
          {isMuted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0.5 }}
              transition={{ duration: 0.25 }}
              className={
                isFocus
                  ? cl.focusMutedIconWrapperCam
                  : isUnfocus
                  ? cl.unfocusMutedIconWrapperCam
                  : cl.mutedIconWrapperCam
              }
            >
              <img
                draggable={false}
                className={
                  isFocus
                    ? cl.focusMutedIconCam
                    : isUnfocus
                    ? cl.unfocusMutedIconCam
                    : cl.mutedIconCam
                }
                src={mutedIcon}
                alt="muted"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

// Мемоизированный компонент для локального видео
const LocalVideoElement = React.memo(
  ({
    localStream,
    isTransmitting,
    isMuted,
    isFocus = false,
    isUnfocus = false,
  }: {
    localStream: MediaStream | null
    isTransmitting: boolean
    isMuted: boolean
    isFocus?: boolean
    isUnfocus?: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      if (!videoElement || !localStream) return

      videoElement.srcObject = localStream
      videoElement.play().catch((error) => {
        console.error('❌ Error playing local video:', error)
      })

      return () => {
        if (videoElement) {
          videoElement.srcObject = null
        }
      }
    }, [localStream])

    if (!localStream) return null

    const hasVideo = localStream.getVideoTracks().length > 0
    if (!hasVideo) return null

    const videoClass = isFocus
      ? isTransmitting
        ? cl.focusVideoActive
        : cl.focusVideo
      : isUnfocus
      ? isTransmitting
        ? cl.unfocusVideoActive
        : cl.unfocusVideo
      : isTransmitting
      ? cl.cameraActive
      : cl.camera

    const containerClass = isFocus
      ? cl.focusVideoContainer
      : isUnfocus
      ? cl.unfocusVideoContainer
      : cl.avatarContainer

    return (
      <div className={containerClass}>
        {!isFocus && !isUnfocus && (
          <AnimatePresence>
            {isTransmitting && (
              <motion.div
                style={{ zIndex: 5 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cl.boxWave1} />
                <div className={cl.boxWave2} />
                <div className={cl.boxWave3} />
                <div className={cl.boxWave4} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          className={videoClass}
        />
        <AnimatePresence>
          {isMuted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0.5 }}
              transition={{ duration: 0.25 }}
              className={
                isFocus
                  ? cl.focusMutedIconWrapperCam
                  : isUnfocus
                  ? cl.unfocusMutedIconWrapperCam
                  : cl.mutedIconWrapperCam
              }
            >
              <img
                draggable={false}
                className={
                  isFocus
                    ? cl.focusMutedIconCam
                    : isUnfocus
                    ? cl.unfocusMutedIconCam
                    : cl.mutedIconCam
                }
                src={mutedIcon}
                alt="muted"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

const ScreenShareElement = React.memo(
  ({
    consumerData,
    openedScreens,
    setOpenedScreens,
    setFocus, // Добавляем setFocus в пропсы
    isVideoCall,
  }: {
    consumerData: ConsumerData
    openedScreens: string[]
    setOpenedScreens: React.Dispatch<React.SetStateAction<string[]>>
    setFocus?: React.Dispatch<React.SetStateAction<IFocus | null>>
    isVideoCall?: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const trackRef = useRef<MediaStreamTrack | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Используем ID consumer'а для проверки открытости
    const userId = consumerData.userId
    const isOpened = openedScreens.includes(userId)

    const handleOpen = () => {
      if (userId && !openedScreens.includes(userId)) {
        setOpenedScreens((prev: string[]) => {
          const newOpenedScreens = [...prev, userId]
          return newOpenedScreens
        })
      }
    }

    const handleClose = () => {
      if (userId && openedScreens.includes(userId)) {
        setOpenedScreens((prev: string[]) => {
          const newOpenedScreens = prev.filter((el) => el !== userId)
          return newOpenedScreens
        })
      }
    }

    const handleScreenClick = () => {
      if (isVideoCall && setFocus && !isOpened) {
        setFocus({ userId, isScreenShare: true })
      }
    }

    useEffect(() => {
      const videoElement = videoRef.current
      const track = consumerData.consumer?.track

      if (!videoElement || !track) return

      // Если трек не изменился и стрим уже установлен, не делаем ничего
      if (trackRef.current === track && streamRef.current) {
        // Если видео уже воспроизводится, просто возвращаемся
        if (videoElement.srcObject === streamRef.current) {
          return
        }
      }

      // Сохраняем текущий трек
      trackRef.current = track

      // Останавливаем предыдущий стрим, но НЕ останавливаем треки!
      if (streamRef.current) {
        // Важно: не останавливаем треки, только очищаем ссылку
        streamRef.current = null
      }

      // Создаем новый стрим с тем же треком
      const newStream = new MediaStream([track])
      streamRef.current = newStream
      videoElement.srcObject = newStream

      // Воспроизводим видео
      videoElement.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error playing screen share:', error)
        }
      })

      return () => {
        // Cleanup при размонтировании компонента
        // НЕ останавливаем треки, так как они управляются consumer'ом
        if (videoElement) {
          videoElement.srcObject = null
        }
        // Не останавливаем streamRef.current, так как треки должны продолжать работать
      }
    }, [consumerData.consumer?.track, isOpened])

    console.log('ScreenShareElement render:', {
      userId,
      isOpened,
      hasTrack: !!consumerData.consumer?.track,
      trackState: consumerData.consumer?.track?.readyState,
      openedScreens,
    })

    if (isOpened) {
      return (
        <div className={cl.otherStreamContainer}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={true}
            className={cl.camera}
            onLoadedMetadata={() => {
              console.log('Screen share video metadata loaded')
              videoRef.current?.play().catch(console.error)
            }}
            onCanPlay={() => {
              console.log('Screen share video can play')
              videoRef.current?.play().catch(console.error)
            }}
          />
          <button onClick={handleClose} className={cl.buttonCloseStream}>
            <img
              draggable={false}
              className={cl.iconCloseStream}
              src={closeStreamIcon}
              alt="close"
            />
          </button>
        </div>
      )
    } else {
      return (
        <div
          onClick={handleScreenClick}
          style={isVideoCall ? { cursor: 'pointer' } : {}}
        >
          <ClosedStream handleOpen={handleOpen} />
        </div>
      )
    }
  }
)

const LocalScreenShareElement = React.memo(
  ({
    screenStream,
    isScreenSharing,
    setFocus, // Добавляем setFocus в пропсы
    isVideoCall,
  }: {
    screenStream: MediaStream | null
    isScreenSharing: boolean
    setFocus?: React.Dispatch<React.SetStateAction<IFocus | null>>
    isVideoCall?: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const currentUserId = localStorage.getItem('user-id')

    useEffect(() => {
      const videoElement = videoRef.current
      if (!videoElement || !screenStream) return

      videoElement.srcObject = screenStream
      videoElement.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error playing local screen share:', error)
        }
      })

      return () => {
        if (videoElement) {
          videoElement.srcObject = null
        }
      }
    }, [screenStream])

    if (!isScreenSharing || !screenStream) return null

    const handleClick = () => {
      if (isVideoCall && setFocus) {
        setFocus({ userId: currentUserId || '', isScreenShare: true })
      }
    }

    return (
      <div
        onClick={handleClick}
        style={isVideoCall ? { cursor: 'pointer' } : {}}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          className={cl.camera}
        />
      </div>
    )
  }
)

const ClosedStream = ({ handleOpen }: { handleOpen: any }) => {
  return (
    <div className={cl.closedStream}>
      <button onClick={handleOpen} className={cl.buttonWatchStream}>
        Watch Stream
      </button>
    </div>
  )
}

const FocusElement = ({
  focus,
  localStream,
  localScreenShare,
  consumers,
  isCameraOn,
  isScreenSharing,
  isTransmitting,
  isMicroMuted,
  mutedUsers,
  speakingUsers,
}: {
  focus: IFocus
  localStream: MediaStream | null
  localScreenShare: MediaStream | null
  consumers: Consumers
  isCameraOn: boolean
  isScreenSharing: boolean
  isTransmitting: boolean
  isMicroMuted: boolean
  mutedUsers: Set<string>
  speakingUsers: Set<string>
}) => {
  const currentUserId = localStorage.getItem('user-id')
  const currentUserAvatar = localStorage.getItem('avatar')
  const currentUsername = localStorage.getItem('username')

  // Выносим логику создания stream на верхний уровень
  const consumerEntries = Object.values(consumers)
  let consumerData: ConsumerData | undefined

  if (focus.userId !== currentUserId) {
    if (focus.isScreenShare) {
      consumerData = consumerEntries.find(
        (c) =>
          c.userId === focus.userId && c.isScreenShare && c.kind === 'video'
      )
    } else {
      consumerData = consumerEntries.find(
        (c) =>
          c.userId === focus.userId && !c.isScreenShare && c.kind === 'video'
      )
      if (!consumerData) {
        consumerData = consumerEntries.find(
          (c) =>
            c.userId === focus.userId && !c.isScreenShare && c.kind === 'audio'
        )
      }
    }
  }

  // Мемоизируем stream ДО любых условий
  const stream = useMemo(
    () =>
      consumerData?.consumer?.track
        ? new MediaStream([consumerData.consumer.track])
        : null,
    [consumerData?.consumer?.track]
  )

  if (focus.userId === currentUserId) {
    if (focus.isScreenShare) {
      return (
        <div className={cl.focusElement}>
          {localScreenShare ? (
            <FocusScreenShareElement stream={localScreenShare} isLocal={true} />
          ) : (
            <div className={cl.focusPlaceholder}>No screen share</div>
          )}
        </div>
      )
    } else {
      if (isCameraOn && localStream) {
        return (
          <div className={cl.focusElement}>
            <LocalVideoElement
              localStream={localStream}
              isTransmitting={isTransmitting}
              isMuted={mutedUsers.has(currentUserId || '')}
              isFocus={true}
            />
          </div>
        )
      } else {
        return (
          <div className={cl.focusElement}>
            <div className={cl.focusAvatarContainer}>
              <div
                className={
                  isTransmitting
                    ? cl.focusBoxAvatarContainerActive
                    : cl.focusBoxAvatarContainer
                }
              >
                <img
                  draggable={false}
                  src={currentUserAvatar || '/default-avatar.png'}
                  alt={currentUsername || 'user'}
                  className={cl.focusBoxAvatarBackground}
                />
                <div className={cl.avatarAndMuteBoxWrapper}>
                  <img
                    draggable={false}
                    src={currentUserAvatar || '/default-avatar.png'}
                    alt={currentUsername || 'user'}
                    className={
                      isTransmitting
                        ? cl.focusBoxAvatarImageActive
                        : mutedUsers.has(currentUserId || '')
                        ? cl.focusBoxAvatarImageMuted
                        : cl.focusBoxAvatarImage
                    }
                  />
                  <AnimatePresence>
                    {isMicroMuted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0.5 }}
                        transition={{ duration: 0.25 }}
                        className={cl.focusMutedIconWrapper}
                      >
                        <img
                          draggable={false}
                          className={cl.focusMutedIcon}
                          src={mutedIcon}
                          alt="muted"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )
      }
    }
  } else {
    if (consumerData) {
      if (focus.isScreenShare && consumerData.kind === 'video') {
        return (
          <div className={cl.focusElement}>
            <FocusScreenShareElement stream={stream} isLocal={false} />
          </div>
        )
      } else if (!focus.isScreenShare && consumerData.kind === 'video') {
        return (
          <div className={cl.focusElement}>
            <UserVideoElement
              consumerData={consumerData}
              isMuted={mutedUsers.has(focus.userId)}
              isSpeaking={speakingUsers.has(focus.userId)}
              isVideoCall={true}
              isFocus={true}
            />
          </div>
        )
      } else if (!focus.isScreenShare && consumerData.kind === 'audio') {
        const isMuted = mutedUsers.has(focus.userId)
        const isSpeaking = speakingUsers.has(focus.userId)

        return (
          <div className={cl.focusElement}>
            <div className={cl.focusAvatarContainer}>
              <div
                className={
                  isSpeaking
                    ? cl.focusBoxAvatarContainerActive
                    : cl.focusBoxAvatarContainer
                }
              >
                <img
                  draggable={false}
                  src={consumerData.avatar || '/default-avatar.png'}
                  alt={consumerData.username || 'user'}
                  className={cl.focusBoxAvatarBackground}
                />
                <div className={cl.avatarAndMuteBoxWrapper}>
                  <img
                    draggable={false}
                    src={consumerData.avatar || '/default-avatar.png'}
                    alt={consumerData.username || 'user'}
                    className={
                      isSpeaking
                        ? cl.focusBoxAvatarImageActive
                        : mutedUsers.has(currentUserId || '')
                        ? cl.focusBoxAvatarImageMuted
                        : cl.focusBoxAvatarImage
                    }
                  />
                  <AnimatePresence>
                    {isMuted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0.5 }}
                        transition={{ duration: 0.25 }}
                        className={cl.focusMutedIconWrapper}
                      >
                        <img
                          draggable={false}
                          className={cl.focusMutedIcon}
                          src={mutedIcon}
                          alt="muted"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )
      }
    }

    return (
      <div className={cl.focusElement}>
        <div className={cl.focusPlaceholder}>User not available</div>
      </div>
    )
  }
}
const UnfocusElements = ({
  focus,
  localStream,
  localScreenShare,
  consumers,
  isCameraOn,
  isScreenSharing,
  isTransmitting,
  isMicroMuted,
  mutedUsers,
  speakingUsers,
  isVideoCall,
  setFocus,
}: {
  focus: IFocus
  localStream: MediaStream | null
  localScreenShare: MediaStream | null
  consumers: Consumers
  isCameraOn: boolean
  isScreenSharing: boolean
  isTransmitting: boolean
  isMicroMuted: boolean
  mutedUsers: Set<string>
  speakingUsers: Set<string>
  isVideoCall: boolean
  setFocus: React.Dispatch<React.SetStateAction<IFocus | null>>
}) => {
  const currentUserId = localStorage.getItem('user-id')
  const currentUserAvatar = localStorage.getItem('avatar')
  const currentUsername = localStorage.getItem('username')

  // Мемоизируем извлечение screen consumers и создание streams
  const screenStreams = useMemo(() => {
    const streams: Record<string, MediaStream | null> = {}

    Object.values(consumers).forEach((consumerData) => {
      if (
        consumerData.kind === 'video' &&
        consumerData.isScreenShare &&
        consumerData.consumer?.track
      ) {
        // Используем track.id как ключ для стабильности
        const trackId = consumerData.consumer.track.id
        const userId = consumerData.userId

        // Создаем stream только если трек изменился
        if (
          !streams[userId] ||
          streams[userId]?.getTracks()[0]?.id !== trackId
        ) {
          streams[userId] = new MediaStream([consumerData.consumer.track])
        }
      }
    })

    return streams
  }, [consumers]) // Зависимость только от consumers

  const unfocusElements: React.ReactElement[] = []

  // 1. Локальные элементы (кроме того, что в фокусе)
  if (focus.userId !== currentUserId || focus.isScreenShare) {
    if (isCameraOn && localStream) {
      unfocusElements.push(
        <div
          key="local-video"
          onClick={() =>
            setFocus({ userId: currentUserId || '', isScreenShare: false })
          }
        >
          <LocalVideoElement
            localStream={localStream}
            isTransmitting={isTransmitting}
            isMuted={mutedUsers.has(currentUserId || '')}
            isUnfocus={true}
          />
        </div>
      )
    } else {
      unfocusElements.push(
        <div
          key="local-avatar"
          onClick={() =>
            setFocus({ userId: currentUserId || '', isScreenShare: false })
          }
        >
          <div className={cl.unfocusElement}>
            <div className={cl.unfocusAvatarContainer}>
              <div
                className={
                  isTransmitting
                    ? cl.unfocusBoxAvatarContainerActive
                    : cl.unfocusBoxAvatarContainer
                }
              >
                <img
                  draggable={false}
                  src={currentUserAvatar || '/default-avatar.png'}
                  alt={currentUsername || 'user'}
                  className={cl.unfocusBoxAvatarBackground}
                />
                <div className={cl.avatarAndMuteBoxWrapperUnfocus}>
                  <img
                    draggable={false}
                    src={currentUserAvatar || '/default-avatar.png'}
                    alt={currentUsername || 'user'}
                    className={
                      isTransmitting
                        ? cl.unfocusBoxAvatarImageActive
                        : mutedUsers.has(currentUserId || '')
                        ? cl.unfocusBoxAvatarImageMuted
                        : cl.unfocusBoxAvatarImage
                    }
                  />
                  <AnimatePresence>
                    {isMicroMuted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0.5 }}
                        transition={{ duration: 0.25 }}
                        className={cl.unfocusMutedIconWrapper}
                      >
                        <img
                          draggable={false}
                          className={cl.unfocusMutedIcon}
                          src={mutedIcon}
                          alt="muted"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  }

  if (focus.userId !== currentUserId || !focus.isScreenShare) {
    if (isScreenSharing && localScreenShare) {
      unfocusElements.push(
        <div
          key="local-screen"
          onClick={() =>
            setFocus({ userId: currentUserId || '', isScreenShare: true })
          }
        >
          <UnfocusScreenShareElement stream={localScreenShare} isLocal={true} />
        </div>
      )
    }
  }

  // 2. Элементы других пользователей
  // Группируем consumers по userId с мемоизацией
  const users = useMemo(() => {
    const usersMap: Record<string, ConsumerData[]> = {}
    Object.values(consumers).forEach((consumer) => {
      if (!usersMap[consumer.userId]) {
        usersMap[consumer.userId] = []
      }
      usersMap[consumer.userId].push(consumer)
    })
    return usersMap
  }, [consumers])

  for (const [userId, userConsumers] of Object.entries(users)) {
    if (userId === currentUserId) continue

    const audioConsumer = userConsumers.find(
      (c) => c.kind === 'audio' && !c.isScreenShare
    )
    const videoConsumer = userConsumers.find(
      (c) => c.kind === 'video' && !c.isScreenShare
    )
    const screenConsumer = userConsumers.find(
      (c) => c.kind === 'video' && c.isScreenShare
    )

    const userData = userConsumers[0]
    const isMuted = mutedUsers.has(userId)
    const isSpeaking = speakingUsers.has(userId)

    // Для пользователя в фокусе показываем только противоположный элемент
    if (userId === focus.userId) {
      if (focus.isScreenShare) {
        if (videoConsumer) {
          unfocusElements.push(
            <div
              key={`video-${userId}`}
              onClick={() => setFocus({ userId, isScreenShare: false })}
            >
              <UserVideoElement
                consumerData={videoConsumer}
                isMuted={isMuted}
                isSpeaking={isSpeaking}
                isVideoCall={isVideoCall}
                isUnfocus={true}
              />
            </div>
          )
        } else if (audioConsumer) {
          unfocusElements.push(
            <div
              key={`audio-${userId}`}
              onClick={() => setFocus({ userId, isScreenShare: false })}
            >
              <div className={cl.unfocusElement}>
                <div className={cl.unfocusAvatarContainer}>
                  <div
                    className={
                      isSpeaking
                        ? cl.unfocusBoxAvatarContainerActive
                        : cl.unfocusBoxAvatarContainer
                    }
                  >
                    <img
                      draggable={false}
                      src={userData.avatar || '/default-avatar.png'}
                      alt={userData.username || 'user'}
                      className={cl.unfocusBoxAvatarBackground}
                    />
                    <div className={cl.avatarAndMuteBoxWrapperUnfocus}>
                      <img
                        draggable={false}
                        src={userData.avatar || '/default-avatar.png'}
                        alt={userData.username || 'user'}
                        className={
                          isSpeaking
                            ? cl.unfocusBoxAvatarImageActive
                            : mutedUsers.has(currentUserId || '')
                            ? cl.unfocusBoxAvatarImageMuted
                            : cl.unfocusBoxAvatarImage
                        }
                      />
                      <AnimatePresence>
                        {isMuted && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0.5 }}
                            transition={{ duration: 0.25 }}
                            className={cl.unfocusMutedIconWrapper}
                          >
                            <img
                              draggable={false}
                              className={cl.unfocusMutedIcon}
                              src={mutedIcon}
                              alt="muted"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      } else {
        if (screenConsumer) {
          unfocusElements.push(
            <UnfocusScreenShareElement
              key={`screen-${userId}`}
              stream={screenStreams[userId]}
              isLocal={false}
              onClick={() => setFocus({ userId, isScreenShare: true })}
            />
          )
        }
      }
    } else {
      // Для остальных пользователей показываем ВСЕ их элементы
      if (videoConsumer) {
        unfocusElements.push(
          <div
            key={`video-${userId}`}
            onClick={() => setFocus({ userId, isScreenShare: false })}
          >
            <UserVideoElement
              consumerData={videoConsumer}
              isMuted={isMuted}
              isSpeaking={isSpeaking}
              isVideoCall={isVideoCall}
              isUnfocus={true}
            />
          </div>
        )
      } else if (audioConsumer) {
        unfocusElements.push(
          <div
            key={`audio-${userId}`}
            onClick={() => setFocus({ userId, isScreenShare: false })}
          >
            <div className={cl.unfocusElement}>
              <div className={cl.unfocusAvatarContainer}>
                <div
                  className={
                    isSpeaking
                      ? cl.unfocusBoxAvatarContainerActive
                      : cl.unfocusBoxAvatarContainer
                  }
                >
                  <img
                    draggable={false}
                    src={userData.avatar || '/default-avatar.png'}
                    alt={userData.username || 'user'}
                    className={cl.unfocusBoxAvatarBackground}
                  />
                  <img
                    draggable={false}
                    src={userData.avatar || '/default-avatar.png'}
                    alt={userData.username || 'user'}
                    className={
                      isSpeaking
                        ? cl.unfocusBoxAvatarImageActive
                        : mutedUsers.has(currentUserId || '')
                        ? cl.unfocusBoxAvatarImageMuted
                        : cl.unfocusBoxAvatarImage
                    }
                  />
                </div>
                <AnimatePresence>
                  {isMuted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0.5 }}
                      transition={{ duration: 0.25 }}
                      className={cl.unfocusMutedIconWrapper}
                    >
                      <img
                        draggable={false}
                        className={cl.unfocusMutedIcon}
                        src={mutedIcon}
                        alt="muted"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )
      }

      if (screenConsumer) {
        unfocusElements.push(
          <UnfocusScreenShareElement
            key={`screen-${userId}`}
            stream={screenStreams[userId]}
            isLocal={false}
            onClick={() => setFocus({ userId, isScreenShare: true })}
          />
        )
      }
    }
  }

  return <div className={cl.unfocusContainer}>{unfocusElements}</div>
}

const FocusScreenShareElement = React.memo(
  ({
    stream,
    isLocal = false,
  }: {
    stream: MediaStream | null
    isLocal?: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      if (!videoElement || !stream) return

      // Проверяем, изменился ли stream
      if (streamRef.current !== stream) {
        streamRef.current = stream
        videoElement.srcObject = stream

        videoElement.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Error playing focus screen share:', error)
          }
        })
      }

      return () => {
        if (videoElement) {
          videoElement.srcObject = null
        }
      }
    }, [stream])

    if (!stream) return null

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        className={cl.focusVideo}
      />
    )
  },
  (prevProps, nextProps) => {
    // Кастомная функция сравнения для React.memo
    return (
      prevProps.stream === nextProps.stream &&
      prevProps.isLocal === nextProps.isLocal
    )
  }
)

const UnfocusScreenShareElement = React.memo(
  ({
    stream,
    isLocal = false,
    onClick,
  }: {
    stream: MediaStream | null
    isLocal?: boolean
    onClick?: () => void
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      if (!videoElement || !stream) return

      // Проверяем, изменился ли stream
      if (streamRef.current !== stream) {
        streamRef.current = stream
        videoElement.srcObject = stream

        videoElement.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Error playing unfocus screen share:', error)
          }
        })
      }

      return () => {
        if (videoElement) {
          videoElement.srcObject = null
        }
      }
    }, [stream])

    if (!stream) return null

    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        className={cl.unfocusVideo}
        onClick={onClick}
      />
    )
  },
  (prevProps, nextProps) => {
    // Кастомная функция сравнения для React.memo
    return (
      prevProps.stream === nextProps.stream &&
      prevProps.isLocal === nextProps.isLocal &&
      prevProps.onClick === nextProps.onClick
    )
  }
)
