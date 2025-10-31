// Импорты
import { useEffect, useState, useCallback, useRef, useMemo, JSX } from 'react'
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

  // инициализация звуков входа и выхода (и предварительная загрузка сразу, чтобы они срабатывали без задержки)
  useEffect(() => {
    joinSoundRef.current = new Audio(joinSound)
    leaveSoundRef.current = new Audio(leaveSound)

    joinSoundRef.current.load()
    leaveSoundRef.current.load()
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
          audio: {
            echoCancellation: echo,
            noiseSuppression: noise,
            autoGainControl: autoGain,
          },
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
  const createProducer = useCallback(
    async (transport: any, stream: MediaStream, kind: string) => {
      // проверка, что транспорт и стрим инициализированы
      if (!transport || !stream) {
        console.error('ERR: !transport || !stream')
        return null
      }

      try {
        // получаем соответствующие треки
        const tracks =
          kind === 'audio' || kind === 'screenAudio'
            ? stream.getAudioTracks()
            : stream.getVideoTracks()

        if (tracks.length === 0) {
          console.error('ERR: no tracks for', kind)
          return null
        }

        const track = tracks[0]

        if (track.readyState !== 'live') {
          console.error('Track is not live:', kind)
          return null
        }

        // Определяем ключ для producer
        const producerKey = kind

        // если такой продюсер уже существует, то закрываем старый
        if (producersRef.current[producerKey]) {
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

        // создаем новый продюсер
        const producer = await transport.produce({
          track,
          appData,
        })

        producersRef.current[producerKey] = producer

        // Сохраняем в соответствующем state
        if (kind === 'screen' || kind === 'screenAudio') {
          setScreenProducer(producer)
        } else {
          setProducers((prev) => ({ ...prev, [kind]: producer }))
        }

        // Обработчики событий продюсера
        producer.on('transportclose', () => {
          producersRef.current[producerKey] = null
          if (kind === 'screen' || kind === 'screenAudio') {
            setScreenProducer(null)
          } else {
            setProducers((prev) => ({ ...prev, [kind]: undefined }))
          }
        })

        producer.on('trackended', () => {
          producersRef.current[producerKey] = null
          if (kind === 'screen' || kind === 'screenAudio') {
            setScreenProducer(null)
          } else {
            setProducers((prev) => ({ ...prev, [kind]: undefined }))
          }
        })

        return producer
      } catch (error) {
        console.error('Ошибка при создании Producer:', error)
        return null
      }
    },
    [socket, roomId, currentUserId, currentUsername, currentUserAvatar]
  )

  // ! ЗДЕСЬ СДЕЛАЕМ ДЕМКУ

  const getScreenStream = useCallback(async () => {
    try {
      console.log('🖥️ Requesting screen share...')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // @ts-ignore
          cursor: 'always',
          displaySurface: 'screen',
          width: 1920,
          height: 1080,
          frameRate: 60,
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
        },
      })

      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.onended = () => {
          console.log('🔊 System audio ended')
          stopScreenShare()
        }
      }

      console.log('🖥️ Screen stream obtained')

      // Обработчик остановки демонстрации через браузер
      stream.getVideoTracks()[0].onended = () => {
        console.log('🖥️ Screen share ended by browser')
        stopScreenShare()
      }

      return stream
    } catch (error) {
      console.error('❌ Ошибка доступа к экрану с системным звуком: ', error)

      try {
        console.log('🔄 Trying screen share without system audio...')
        const fallbackStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            // @ts-ignore
            cursor: 'always',
            displaySurface: 'screen',
            width: 1920,
            height: 1080,
            frameRate: 60,
          },
          audio: false,
        })

        console.log('✅ Screen share without audio obtained')
        return fallbackStream
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
        return null
      }
    }
  }, [])

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      console.log('🖥️ Screen share already active')
      return
    }

    try {
      console.log('🖥️ Starting screen share...')
      const stream = await getScreenStream()
      if (stream) {
        console.log('🖥️ Screen stream obtained successfully')
        setScreenStream(stream)
        setIsScreenSharing(true)
      } else {
        console.error('❌ Failed to get screen stream')
        setIsScreenSharing(false)
      }
    } catch (error) {
      console.error('❌ Error starting screen share:', error)
      setIsScreenSharing(false)
    }
  }, [getScreenStream, isScreenSharing])

  const stopScreenShare = useCallback(() => {
    console.log('🖥️ Stopping screen share...')

    // Останавливаем screen stream
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        track.stop()
      })
      setScreenStream(null)
    }

    // Закрываем screen video producer если он есть
    if (producersRef.current.screen) {
      console.log('🖥️ Closing screen video producer')
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

    // Закрываем screen audio producer если он есть
    if (producersRef.current.screenAudio) {
      console.log('🔊 Closing screen audio producer')
      if (socket && roomId) {
        socket.emit('producer-close', {
          producerId: producersRef.current.screenAudio.id,
          roomId,
          appData: { isScreenShare: true },
        })
      }
      producersRef.current.screenAudio.close()
      producersRef.current.screenAudio = null
    }

    setIsScreenSharing(false)
  }, [screenStream, socket, roomId])

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) stopScreenShare()
    else startScreenShare()
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  // Обработка создания screen producer при получении screenStream
  useEffect(() => {
    const createScreenProducer = async () => {
      if (!screenStream || !sendTransport || !isConnected) {
        return
      }

      try {
        console.log('🖥️ Creating screen producers...')

        // Создаем видео продюсер для демки
        const screenVideoTrack = screenStream.getVideoTracks()[0]
        if (screenVideoTrack) {
          await createProducer(
            sendTransport,
            new MediaStream([screenVideoTrack]),
            'screen'
          )
          console.log('✅ Screen video producer created successfully')
        }

        // Создаем аудио продюсер для системного звука
        const screenAudioTrack = screenStream.getAudioTracks()[0]
        if (screenAudioTrack) {
          await createProducer(
            sendTransport,
            new MediaStream([screenAudioTrack]),
            'screenAudio'
          )
          console.log('✅ Screen audio producer created successfully')
        }
      } catch (error) {
        console.error('❌ Error creating screen producers:', error)
      }
    }

    if (screenStream && isScreenSharing) {
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
  const handleCreateConsumer = useCallback(
    async (producerData: ProducerData) => {
      // проверка, что девайс и транспорт получения инициализированы
      if (!recvTransportRef.current || !device) {
        return null
      }

      try {
        const consumer = await createConsumer(
          producerData.producerId,
          //@ts-ignore
          device.rtpCapabilities
        )

        if (!consumer) {
          return null
        }

        // если консюмер с типом аудио и у него есть трек
        if (consumer.kind === 'audio' && consumer.track) {
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

            if (!isScreenOpened) {
              audioElement.pause()
              audioElement.muted = true
            }
          }

          audioElement.oncanplaythrough = () => {
            console.log(
              'Audio element ready to play for consumer:',
              consumer.id
            )
          }

          audioElement.onerror = (error) => {
            console.error(
              'Audio element error for consumer:',
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
            } catch (error: any) {
              if (error.name === 'AbortError') {
                return
              } else if (error.name === 'NotAllowedError') {
                return
              } else {
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
            playAudioWithRetry()
          }
        }

        return consumer
      } catch (error) {
        return null
      }
    },
    [device, createConsumer, openedScreens] // Добавляем openedScreens в зависимости
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
        console.log('Skipping own producer')
        return
      }

      // Проверяем, не существует ли уже consumer с этим producerId
      if (consumers[data.producerId]) {
        console.log('Consumer already exists for producer:', data.producerId)
        return
      }

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
          'Received new producer:',
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
          'Successfully created consumer for producer:',
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
    setIsVideoCall(isCameraOn || hasOtherUsersVideo)
  }, [isCameraOn, hasOtherUsersVideo])

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
          muted={false}
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
            muted={false}
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
              </div>
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
        )
      }
    }
  } else {
    const consumerEntries = Object.values(consumers)
    let consumerData: ConsumerData | undefined

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

    if (consumerData) {
      if (focus.isScreenShare && consumerData.kind === 'video') {
        const stream = consumerData.consumer?.track
          ? new MediaStream([consumerData.consumer.track])
          : null
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
                <img
                  draggable={false}
                  src={consumerData.avatar || '/default-avatar.png'}
                  alt={consumerData.username || 'user'}
                  className={
                    isSpeaking
                      ? cl.focusBoxAvatarImageActive
                      : isMuted
                      ? cl.focusBoxAvatarImageMuted
                      : cl.focusBoxAvatarImage
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

  const unfocusElements: React.ReactElement[] = []

  // 1. Локальные элементы (кроме того, что в фокусе)
  if (focus.userId !== currentUserId || focus.isScreenShare) {
    // Показываем локальную вебку/аватарку если:
    // - фокус на чужом элементе ИЛИ
    // - фокус на нашей демке
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
              </div>
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
      )
    }
  }

  if (focus.userId !== currentUserId || !focus.isScreenShare) {
    // Показываем локальную демку если:
    // - фокус на чужом элементе ИЛИ
    // - фокус на нашей вебке/аватарке
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
  const consumerEntries = Object.values(consumers)
  const users: Record<string, ConsumerData[]> = {}

  consumerEntries.forEach((consumer) => {
    if (!users[consumer.userId]) {
      users[consumer.userId] = []
    }
    users[consumer.userId].push(consumer)
  })

  for (const [userId, userConsumers] of Object.entries(users)) {
    // Пропускаем текущего пользователя
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
        // Если в фокусе демка пользователя, показываем его вебку/аватарку
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
      } else {
        // Если в фокусе вебка/аватарка пользователя, показываем его демку
        if (screenConsumer) {
          const stream = screenConsumer.consumer?.track
            ? new MediaStream([screenConsumer.consumer.track])
            : null
          unfocusElements.push(
            <UnfocusScreenShareElement
              key={`screen-${userId}`}
              stream={stream}
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
        const stream = screenConsumer.consumer?.track
          ? new MediaStream([screenConsumer.consumer.track])
          : null
        unfocusElements.push(
          <UnfocusScreenShareElement
            key={`screen-${userId}`}
            stream={stream}
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
        muted={isLocal}
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
        muted={isLocal}
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
