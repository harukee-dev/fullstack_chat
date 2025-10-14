// Импорты
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMediaSoup } from '../../hooks/useMediaSoup'
import { useSocket } from '../../SocketContext'
import cl from './room.module.css'
import leaveSound from './sounds/leave-sound.mp3'
import joinSound from './sounds/join-sound.mp3'
import mutedIcon from './images/muted-microphone-icon.png'
import { AnimatePresence, motion } from 'framer-motion'
import { useAudioVolume, useAudioControl } from './roomUtils'
// Интерфейс для данных о потребителе медиа
interface ConsumerData {
  consumer: any // объект Consumer - получает медиа от других пользователей
  kind: string // тип медиа - 'audio'/'video'
  type: ''
  userId: string // ID пользователя
  username?: string // ник пользователя от которого мы получаем медиа
  avatar?: string // аватарка пользователя от которого мы получаем медиа
}

// Интерфейс для производителей медиа - то есть для отправки медиа серверу
interface Producers {
  [key: string]: any
  audio?: any // есть ли аудио в нашем медиа
  video?: any // есть ли видео в нашем медиа
}

// Интерфейс для хранения всех потребителей
interface Consumers {
  [producerId: string]: ConsumerData // ключ - айди продюсера, значение - данные о консюмере
}

export const Room = () => {
  const currentUserId = localStorage.getItem('user-id') // текущий айди локального пользователя
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

  const joinSoundRef = useRef<HTMLAudioElement | null>(null)
  const leaveSoundRef = useRef<HTMLAudioElement | null>(null)

  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())

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

  useEffect(() => {
    userIdRef.current = socket?.id || ''
  }, [socket])

  useEffect(() => {
    socket?.emit('get-muted-users', roomId)
  }, [socket])

  useEffect(() => {
    if (isMicroMuted) {
      socket?.emit('user-muted', { userId: currentUserId, roomId: roomId })
    } else {
      socket?.emit('user-unmuted', { userId: currentUserId, roomId: roomId })
    }
  }, [isMicroMuted, socket, currentUserId, roomId])

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
      // принимаем состояние, включена ли камера
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // получаем локальный стрим из нашего девайса
          // если микрофон не замучен
          audio: {
            // то будет аудио с такими настройками
            echoCancellation: true, // эхоподавление
            noiseSuppression: true, // шумоподавление
            autoGainControl: true, // автоусиление громкости
          }, // если микрофон замучен, то не отправляем звук
          video: isCameraOn // если камера включена
            ? {
                // отправляем наше видео с такими настройками
                width: 1280, // HD
                height: 720, // HD
                frameRate: 30, // 30FPS
                // позже сюда добавим возможность настраивать самому качество видео, если есть подписка
              }
            : false, // если камера выключена, не отправляем ее
        })
        return stream // функция возвращает наш стрим
      } catch (error) {
        // обработка ошибок при получении локального стрима
        console.error('Ошибка при получении медиаданных пользователя', error)
        return null
      }
    },
    [isCameraOn] // в зависимостях замучен ли микрофон и включена ли камера
  )

  // Создание Producer - объекта, который отправляет медиа данные на сервер
  const createProducer = useCallback(
    async (transport: any, stream: MediaStream, kind: string) => {
      if (!transport || !stream) {
        console.error('ERR: !transport || !stream')
        return null
      }

      try {
        const tracks =
          kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks()
        if (tracks.length === 0) {
          console.error('ERR: no tracks for', kind)
          return null
        }

        const track = tracks[0]
        if (track.readyState !== 'live') {
          console.error('Track is not live:', kind)
          return null
        }

        if (producersRef.current[kind]) {
          console.log('Closing existing', kind, 'producer')
          producersRef.current[kind].close()
          producersRef.current[kind] = null
        }

        console.log('Creating', kind, 'producer...')
        const producer = await transport.produce({
          track,
          appData: { mediaTag: kind },
        })

        producersRef.current[kind] = producer
        setProducers((prev) => ({ ...prev, [kind]: producer }))
        console.log(`${kind} Producer создан:`, producer.id)

        // ВАЖНО: Отправляем событие о новом продюсере для ВСЕХ видов
        if (socket && roomId) {
          socket.emit('new-producer', {
            producerId: producer.id,
            kind: kind,
            userId: userIdRef.current,
            roomId: roomId,
            username: localStorage.getItem('username'),
            avatar: localStorage.getItem('avatar'),
          })
          console.log(
            `📤 Sent new-producer event for ${kind} producer:`,
            producer.id
          )
        }

        // Обработчики событий продюсера
        producer.on('transportclose', () => {
          console.log('Producer transport closed:', kind)
          producersRef.current[kind] = null
          setProducers((prev) => ({ ...prev, [kind]: undefined }))
        })

        producer.on('trackended', () => {
          console.log('Producer track ended:', kind)
          producersRef.current[kind] = null
          setProducers((prev) => ({ ...prev, [kind]: undefined }))
        })

        return producer
      } catch (error) {
        console.error('Ошибка при создании Producer:', error)
        return null
      }
    },
    [socket, roomId]
  )

  const { isSpeaking } = useAudioVolume(localStream, -30)
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
  })

  // Создание Consumer - объекта, который получает медиа данные от других пользователей
  // Room.tsx - в функции handleCreateConsumer
  const handleCreateConsumer = useCallback(
    async (producerData: {
      producerId: string
      kind: string
      userId: string
    }) => {
      if (!recvTransportRef.current || !device) {
        console.error('Receive transport or device not available')
        return null
      }

      try {
        console.log(
          'Creating consumer for producer:',
          producerData.producerId,
          'kind:',
          producerData.kind
        )

        const consumer = await createConsumer(
          producerData.producerId,
          //@ts-ignore
          device.rtpCapabilities
        )

        if (!consumer) {
          console.error(
            'Failed to create consumer for producer:',
            producerData.producerId
          )
          return null
        }

        console.log(
          'Consumer created successfully:',
          consumer.id,
          'kind:',
          consumer.kind
        )

        if (consumer.kind === 'audio' && consumer.track) {
          // Улучшенная обработка аудио элемента
          const audioElement = document.createElement('audio')
          audioElement.srcObject = new MediaStream([consumer.track])
          audioElement.autoplay = true
          // @ts-ignore
          audioElement.playsInline = true
          audioElement.muted = false
          audioElement.style.display = 'none'

          // Добавляем обработчики для управления воспроизведением
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

          // Улучшенная функция воспроизведения с обработкой прерываний
          const playAudioWithRetry = async (retryCount = 0) => {
            try {
              await audioElement.play()
              console.log(
                'Audio playing successfully for consumer:',
                consumer.id
              )
            } catch (error: any) {
              if (error.name === 'AbortError') {
                console.log(
                  'Audio play was aborted, this is normal during stream changes'
                )
                // Не повторяем попытку для AbortError - это нормально при смене стримов
                return
              } else if (error.name === 'NotAllowedError') {
                console.log('Audio play not allowed, user interaction required')
                return
              } else {
                console.error(
                  'Ошибка при воспроизведении звука от consumer:',
                  error,
                  'retry count:',
                  retryCount
                )

                // Повторяем попытку только для определенных ошибок
                if (retryCount < 3 && error.name !== 'AbortError') {
                  setTimeout(
                    () => playAudioWithRetry(retryCount + 1),
                    100 * (retryCount + 1)
                  )
                }
              }
            }
          }

          playAudioWithRetry()
        }

        return consumer
      } catch (error) {
        console.error('Ошибка при создании consumer:', error)
        return null
      }
    },
    [device, createConsumer]
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

    const handleNewProducer = async (data: {
      // функция получения нового продюсера
      producerId: string // айди продюсера
      kind: string // тип медиа данных
      userId: string // айди юзера, от которого получаем продюсер
      username?: string // ник юзера
      avatar?: string // аватарка юзера
    }) => {
      if (consumers[data.producerId]) {
        return
      }
      const existingAudioConsumer = Object.values(consumers).find(
        (consumerData) =>
          consumerData.userId === data.userId &&
          consumerData.kind === 'audio' &&
          data.kind === 'audio'
      )

      if (existingAudioConsumer) {
        return
      }
      try {
        console.log(
          'Received new producer:',
          data.producerId,
          data.kind,
          'from user:',
          data.userId
        ) // логируем получение нового продюсера

        if (data.userId === userIdRef.current) {
          // если это наш продюсер, то заканчиваем функцию - нам не нужно делать прослушивать наших же медиа данных
          console.log('Skipping own producer')
          return
        }

        // 1. Сначала создаём consumer для нового продюсера
        const consumer = await handleCreateConsumer(data)
        if (!consumer) {
          // Если не удалось создать consumer — выходим
          return
        }
        // 2. Обновляем consumers: удаляем старые с этим userId и добавляем новый
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
            },
          }
        })

        // Room.tsx - в обработчиках событий консюмера
        consumer.on('transportclose', () => {
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
          console.log(
            'Consumer transport closed for producer:',
            data.producerId
          )
          setConsumers((prev) => {
            const newConsumers = { ...prev }
            delete newConsumers[data.producerId]
            return newConsumers
          })
        })

        consumer.on('producerclose', () => {
          console.log('Producer closed, removing consumer:', data.producerId)
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
      } catch (error) {
        console.error('Ошибка при создании consumer:', error) // логирование ошибок
      }
    }

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
    const handleExistingProducers = async (
      producersList: Array<{
        // получаем список продюсеров, которые состоят из
        producerId: string // айди продюсера
        kind: string // тип продюсера (видео или аудио)
        userId: string // айди юзера данного продюсера
        username?: string // никнейм юзера данного продюсера
        avatar?: string // аватарка юзера данного продюсера
      }>
    ) => {
      console.log('Received existing producers:', producersList) // логируем получение уже существующих продюсеров

      for (const producer of producersList) {
        // проходимся по каждому продюсеру из списка

        if (consumers[producers.producerId]) continue

        if (producer.userId !== userIdRef.current) {
          // если этот продюсер не является нашим
          await handleNewProducer(producer) // вызываем функцию обработчик нового продюсера, которая создаст консюмер из этого продюсера для получения медиа данных от другого пользователя
        }
      }
    }

    socket.on('new-producer', handleNewProducer) // обработчик сокета о новом продюсере
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
    if (leaveSoundRef.current) {
      if (!leaveSoundRef.current.paused) {
        leaveSoundRef.current.pause()
      }

      leaveSoundRef.current.currentTime = 0
      leaveSoundRef.current.play()
    }
  }, [socket, roomId, localStream, consumers, closeTransports]) // прописываем зависимости

  // Логирование Socket событий
  useEffect(() => {
    if (!socket) return // проверка на инициализацию сокета

    const originalEmit = socket.emit // перехватываем socket.emit для логирования исходящих событий
    socket.emit = function (...args) {
      // логируем входящие события
      console.log('📤 SOCKET EMIT:', args[0], args[1])
      return originalEmit.apply(this, args)
    }

    const logEvent = (eventName: string, data: any) => {
      console.log('📥 SOCKET EVENT:', eventName, data)
    }

    socket.on('new-producer', (data) => logEvent('new-producer', data))
    socket.on('existing-producers', (data) =>
      logEvent('existing-producers', data)
    )
    socket.on('producer-close', (data) => logEvent('producer-close', data))

    return () => {
      // восстанавливаем оригинальный emit при cleanup
      socket.emit = originalEmit
      socket.off('new-producer')
      socket.off('existing-producers')
      socket.off('producer-close')
    }
  }, [socket]) // настраиваем зависимости

  // Основная логика подключения (инициализации)
  useEffect(() => {
    const initializeRoom = async () => {
      // функция инициализации комнаты
      if (!isDeviceInitialized || !roomId || isInitializedRef.current) {
        // проверка, что девайс и айди комнаты инициализированы, и что комната еще не инициализирована
        return
      }

      try {
        console.log('Step 1: Initializing room...')
        isInitializedRef.current = true // выставляем, что комната инициализирована

        console.log('Step 2: Creating transports...')
        const { sendTransport, recvTransport } = await createTransports() // создаем транспорты отправки и получения медиа данных

        if (!sendTransport || !recvTransport) {
          // проверка, что транспорты создались корректно
          throw new Error('Failed to create transports') // логирование ошибки
        }

        setSendTransport(sendTransport) // сохраняем транспорт отправки
        recvTransportRef.current = recvTransport // сохраняем транспорт получения
        console.log('Step 3: Transports created successfully')

        console.log('Step 4: Getting media stream...')
        const stream = await getMediaStream(isCameraOn) // получаем локальный стрим с или без камеры
        if (!stream) {
          throw new Error('Failed to get media stream')
        }

        setLocalStream(stream) // сохраняем локальный стрим в state переменной
        console.log('Step 5: Media stream obtained')

        console.log('Step 6: Creating producers...')

        if (isCameraOn) {
          // если камера включена, то создаем продюсер отправки нашего видео
          await createProducer(sendTransport, stream, 'video')
        }

        setIsConnected(true) // выставляем state, что мы подключились
        setReconnectAttempts(0) // сбрасываем количество попыток переподключения
        console.log('Room initialization completed successfully') // логирование успешного подключения

        socket?.emit('joined-to-room', roomId)
      } catch (error) {
        // отладка ошибок
        console.error('Room initialization failed:', error) // логируем
        isInitializedRef.current = false // выставляем, что комната не инициализирована
        setReconnectAttempts((prev) => prev + 1) // увеличиваем state количества переподключенийы

        // умная стратегия повторных попыток подключения
        if (reconnectAttempts < 3) {
          // если количество попыток меньше 3 то пробуем еще раз (избежание бесконечных попыток подклчюения)
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000) // вычиление задержки
          // Math.pow(2, reconnectAttempts) - возводим двойку в степень со значением количества попыток
          // 1000 * Math.pow(2, reconnectAttempts) - переводим в миллисекунды
          // Math.min(..., 8000) - ограничение максимальной задержки
          reconnectTimeoutRef.current = setTimeout(() => {
            // запускем таймер, который через время delay сделает повторную попытку подключения
            initializeRoom()
          }, delay)
          // таймер сохраняем в ref для того, чтобы можно было отменить при размонтировании компонента или при успешном подключении до устечении таймера
        }
      }
    }

    initializeRoom() // вызываем функцию инициализации комнаты

    return () => {
      // cleanup таймера при размонтировании (здесь нам и нужен ref)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [
    isDeviceInitialized,
    roomId,
    createTransports,
    getMediaStream,
    isCameraOn,
    reconnectAttempts,
  ]) // зависимости

  // Обработка изменений state микрофона и камеры
  const isUpdatingMediaRef = useRef(false)

  useEffect(() => {
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

  // Обработка изменений state микрофона и камеры

  const updateMediaStream = useCallback(
    async (cameraOn: boolean) => {
      try {
        console.log('🔄 Updating media stream, camera:', cameraOn)

        // Создаем новый стрим
        const newStream = await getMediaStream(cameraOn)
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

        setLocalStream(newStream)

        console.log('✅ Media stream updated:', {
          videoTracks: newStream.getVideoTracks().length,
          audioTracks: newStream.getAudioTracks().length,
          streamId: newStream.id,
        })

        return newStream
      } catch (error) {
        console.error('❌ Error updating media stream:', error)
        return null
      }
    },
    [localStream, getMediaStream]
  )

  // Обработка изменений state микрофона и камеры

  useEffect(() => {
    const updateMedia = async () => {
      if (!sendTransport || !isConnected || isUpdatingMediaRef.current) {
        return
      }

      isUpdatingMediaRef.current = true

      try {
        console.log('🔄 Updating media stream, camera:', isCameraOn)

        // Всегда создаем новый стрим при изменении состояния камеры
        const newStream = await getMediaStream(isCameraOn)
        if (!newStream) {
          throw new Error('Failed to get media stream')
        }

        // Останавливаем старый стрим
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            if (track.readyState === 'live') {
              track.stop()
            }
          })
        }

        // Устанавливаем новый стрим - это вызовет пересоздание аудиопродюсера в хуке
        setLocalStream(newStream)

        // Логика для видео
        if (isCameraOn && !producersRef.current.video) {
          console.log('📹 Creating video producer...')
          const videoTracks = newStream.getVideoTracks()
          if (videoTracks.length > 0) {
            await createProducer(sendTransport, newStream, 'video')
            console.log('✅ Video producer created')
          }
        } else if (!isCameraOn && producersRef.current.video) {
          console.log('📹 Closing video producer...')
          if (socket) {
            socket.emit('producer-close', {
              producerId: producersRef.current.video.id,
              roomId,
            })
          }
          producersRef.current.video.close()
          producersRef.current.video = null
          setProducers((prev) => ({ ...prev, video: undefined }))
        }

        console.log('✅ Media update completed')
      } catch (error) {
        console.error('❌ Error in updateMedia:', error)
      } finally {
        isUpdatingMediaRef.current = false
      }
    }

    // Используем setTimeout для дебаунса
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
    // объявляем функцию
    console.log('Initiating full retry...')
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

  useEffect(() => {
    // проверяем, есть ли видео у других пользователей
    const hasOtherUsersVideo = Object.values(consumers).some(
      (consumerData) => consumerData.kind === 'video'
    )

    // устанавливаем isVideoCall если есть наша камера или видео у других
    setIsVideoCall(isCameraOn || hasOtherUsersVideo)
  }, [isCameraOn, consumers])

  // Отрисовка других пользователей
  const renderVideoElements = () => {
    return Object.entries(consumers)
      .map(([producerId, consumerData]) => {
        if (!consumerData.consumer || !consumerData.consumer.track) {
          return null
        }

        const userHasVideo = Object.values(consumers).some(
          (el) => el.userId === consumerData.userId && el.kind === 'video'
        )

        const isVideo = consumerData.kind === 'video'
        const isAudio = consumerData.kind === 'audio'
        const isMuted = mutedUsers.has(consumerData.userId)

        // Для аудио - создаем скрытый элемент
        if (isAudio && !userHasVideo) {
          return (
            <div key={producerId}>
              <audio
                ref={(audioElement) => {
                  if (audioElement && consumerData.consumer.track) {
                    audioElement.srcObject = new MediaStream([
                      consumerData.consumer.track,
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
                style={{
                  display: 'none',
                }}
              />
              {isVideoCall ? (
                <div className={cl.boxAvatarContainer}>
                  <img
                    src={consumerData.avatar || '/default-avatar.png'}
                    alt={consumerData.username || 'user'}
                    className={cl.boxAvatarBackground}
                  />
                  <img
                    src={consumerData.avatar || '/default-avatar.png'}
                    alt={consumerData.username || 'user'}
                    className={cl.boxAvatarImage}
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
                          className={cl.mutedIcon}
                          src={mutedIcon}
                          alt="muted"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div>
                  <img
                    src={consumerData.avatar || '/default-avatar.png'}
                    alt={consumerData.username || 'User'}
                    className={cl.avatar}
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

        // Для видео - отображаем видео элемент
        if (isVideo) {
          return (
            <div key={producerId}>
              <video
                ref={(videoElement) => {
                  if (videoElement && consumerData.consumer.track) {
                    videoElement.srcObject = new MediaStream([
                      consumerData.consumer.track,
                    ])
                    videoElement.play().catch((error) => {
                      if (error.name !== 'AbortError') {
                        console.error('Error playing video:', error)
                      }
                    })
                  }
                }}
                autoPlay
                playsInline
                muted={consumerData.userId === currentUserId}
                className={cl.camera}
              />
              <AnimatePresence>
                {isMuted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0.5 }}
                    transition={{ duration: 0.25 }}
                    className={cl.mutedIconWrapperCam}
                  >
                    <img
                      className={cl.mutedIconCam}
                      src={mutedIcon}
                      alt="muted"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        }

        return null
      })
      .filter(Boolean)
  }

  // Отрисовка локального видео
  // Room.tsx - в renderLocalVideo и renderVideoElements
  const renderLocalVideo = () => {
    if (!localStream) return null
    const currentUserAvatar = localStorage.getItem('avatar')
    const isMuted = mutedUsers.has(currentUserId || 'userid')

    if (!isCameraOn) {
      return (
        <div>
          {isVideoCall ? (
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
                  src={currentUserAvatar || '/default-avatar.png'}
                  alt={'you'}
                  className={cl.boxAvatarBackground}
                />
                <img
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
                    <img className={cl.mutedIcon} src={mutedIcon} alt="muted" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )
    } else {
      return (
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
                  <div className={cl.boxWave1} />
                  <div className={cl.boxWave2} />
                  <div className={cl.boxWave3} />
                  <div className={cl.boxWave4} />
                </motion.div>
              )}
            </AnimatePresence>
            <video
              ref={(videoElement) => {
                if (videoElement && localStream) {
                  videoElement.srcObject = localStream
                  videoElement.play().catch((error) => {
                    if (error.name !== 'AbortError') {
                      console.error('Error playing local video:', error)
                    }
                  })
                }
              }}
              autoPlay
              playsInline
              muted={true}
              className={isTransmitting ? cl.cameraActive : cl.camera}
              onError={(e) => console.error('Local video error:', e)}
            />
          </div>
          <AnimatePresence>
            {isMuted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0.5 }}
                transition={{ duration: 0.25 }}
                className={cl.mutedIconWrapperCam}
              >
                <img className={cl.mutedIconCam} src={mutedIcon} alt="muted" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }
  }
  // Отрисовка всего компонента
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Room: {roomId}</h1>

      <div
        style={{
          padding: '10px',
          backgroundColor: isConnected ? '#4CAF50' : '#f44336',
          color: 'white',
          borderRadius: '5px',
          marginBottom: '20px',
        }}
      >
        Status: {isConnected ? 'Connected' : 'Disconnected'}
        {error && (
          <div style={{ marginTop: '10px', fontSize: '14px' }}>
            Error: {error}
            <button
              onClick={handleFullRetry}
              style={{ marginLeft: '10px', padding: '5px 10px' }}
            >
              Full Retry
            </button>
          </div>
        )}
        {isLoading && (
          <div style={{ marginTop: '10px', fontSize: '14px' }}>Loading...</div>
        )}
        {reconnectAttempts > 0 && (
          <div style={{ marginTop: '10px', fontSize: '14px' }}>
            Reconnect attempts: {reconnectAttempts}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={() => setIsMicroMuted(!isMicroMuted)}
          style={{
            marginRight: '15px',
            padding: '10px 20px',
            backgroundColor: isMicroMuted ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {isMicroMuted ? ' Unmute' : ' Mute'}
        </button>

        <button
          onClick={() => setIsCameraOn(!isCameraOn)}
          style={{
            padding: '10px 20px',
            backgroundColor: isCameraOn ? '#4CAF50' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {isCameraOn ? ' Stop Camera' : ' Start Camera'}
        </button>

        <button
          onClick={handleFullRetry}
          style={{
            marginLeft: '15px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Reconnect
        </button>
        <button
          onClick={leaveRoom}
          style={{
            marginLeft: '15px',
            padding: '10px 20px',
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Leave Room
        </button>
      </div>

      <div>
        <h3>Participants:</h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            width: '90vw',
            gap: '1vh',
          }}
        >
          {renderLocalVideo()}
          {renderVideoElements()}
        </div>
      </div>

      <div
        style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#1f1f1fff',
          borderRadius: '5px',
        }}
      >
        <h4>Connection Info:</h4>
        <p>Device Initialized: {isDeviceInitialized ? 'yes' : 'no'}</p>
        <p>Send Transport Ready: {sendTransport ? 'yes' : 'no'}</p>
        <p>Recv Transport Ready: {recvTransportRef.current ? 'yes' : 'no'}</p>
        <p>Local Stream: {localStream ? 'yes' : 'no'}</p>
        <p>Audio Producer: {producers.audio ? 'yes' : 'no'}</p>
        <p>Video Producer: {producers.video ? 'yes' : 'no'}</p>
        <p>Consumers: {Object.keys(consumers).length}</p>
        <p>User ID: {userIdRef.current}</p>
        <p>Reconnect Attempts: {reconnectAttempts}</p>
        <p>MediaSoup Attempts: {mediaSoupAttempts}</p>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>
    </div>
  )
}
