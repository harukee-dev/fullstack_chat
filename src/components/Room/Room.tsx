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
      // принимаем состояние, включена ли камера
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // получаем локальный стрим из нашего девайса
          // всегда получаем аудио
          audio: {
            echoCancellation: true, // эхоподавление
            noiseSuppression: true, // шумоподавление
            autoGainControl: true, // автоусиление громкости
          },
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
    // принимаем транспорт, стрим и тип
    async (transport: any, stream: MediaStream, kind: string) => {
      // проверка, что транспорт и стрим инициализированы
      if (!transport || !stream) {
        console.error('ERR: !transport || !stream')
        return null
      }

      try {
        // получаем видео или аудио треки в зависимости от типа
        const tracks =
          kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks()
        if (tracks.length === 0) {
          console.error('ERR: no tracks for', kind)
          return null
        }
        // берем первый и единственный трек
        const track = tracks[0]
        // проверяем, что он готов к трансляции
        if (track.readyState !== 'live') {
          console.error('Track is not live:', kind)
          return null
        }
        // если такой продюсер уже существует, то закрываем старый
        if (producersRef.current[kind]) {
          producersRef.current[kind].close()
          producersRef.current[kind] = null
        }

        // создаем новый продюсер
        const producer = await transport.produce({
          track,
          appData: { mediaTag: kind },
        })

        producersRef.current[kind] = producer // сохраняем его в рефке
        setProducers((prev) => ({ ...prev, [kind]: producer })) // сохраняем в состоянии

        // проверка, что сокет и id комнаты инициализированы
        if (socket && roomId) {
          // отправляем сокет о том, что создали новый продюсер
          socket.emit('new-producer', {
            producerId: producer.id,
            kind: kind,
            userId: userIdRef.current,
            roomId: roomId,
            username: localStorage.getItem('username'),
            avatar: localStorage.getItem('avatar'),
          })
        }

        // Обработчики событий продюсера

        // закрытие транспорта
        producer.on('transportclose', () => {
          producersRef.current[kind] = null // очищаем рефку продюсера
          setProducers((prev) => ({ ...prev, [kind]: undefined })) // убираем его из стейта
        })

        // закрытие трека
        producer.on('trackended', () => {
          producersRef.current[kind] = null // удаляем его из рефки
          setProducers((prev) => ({ ...prev, [kind]: undefined })) // удаляем его из транспорта
        })

        return producer // возвращаем продюсер
      } catch (error) {
        // отладка ошибок
        console.error('Ошибка при создании Producer:', error)
        return null
      }
    },
    [socket, roomId] // зависимости
  )

  const { isSpeaking } = useAudioVolume(localStream, -30) // получаем динамическую переменную, говорит ли человек (в независимости от того, в муте он или нет)
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
    async (producerData: {
      producerId: string // принимаем id продюсера, из которого нам нужно сделать consumer
      kind: string // тип этого продюсера
      userId: string // и id юзера, который передает этот продюсер
    }) => {
      // проверка, что девайс и транспорт получения инициализированы
      if (!recvTransportRef.current || !device) {
        return null
      }

      try {
        const consumer = await createConsumer(
          producerData.producerId,
          //@ts-ignore
          device.rtpCapabilities
        ) // создаем consumer из продюсера, передавая его айди и параметры кодирования

        // проверка, что консюмер правильно создался
        if (!consumer) {
          return null
        }

        // если консюмер с типом аудио и у него есть трек
        if (consumer.kind === 'audio' && consumer.track) {
          const audioElement = document.createElement('audio') // создаем аудио элемент
          audioElement.srcObject = new MediaStream([consumer.track]) // передаем в него наш трек (чтобы воспроизводить его звук, как только мы создали консюмер)
          audioElement.autoplay = true // включаем авто запуск
          // @ts-ignore
          audioElement.playsInline = true
          audioElement.muted = false
          audioElement.style.display = 'none'

          // Добавляем обработчики для управления воспроизведением - просто логи событий
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

          document.body.appendChild(audioElement) // добавляем в DOM наш аудио элемент, чтобы аудиотрек консюмера воспроизводился
          consumer.audioElement = audioElement // сохраняем внутри этого консюмера аудио элемент, чтобы мы могли получить к нему доступ в будущем, если пригодится (например чтобы удалить его при удалении консюмера)

          // Функция воспроизведения с обработкой прерываний
          const playAudioWithRetry = async (retryCount = 0) => {
            try {
              await audioElement.play()
            } catch (error: any) {
              // отладка ошибок
              if (error.name === 'AbortError') {
                return // если AbortError - не повторяем попытку
              } else if (error.name === 'NotAllowedError') {
                return // здесь тоже не повторяем попытку
              } else {
                // в остальных случаях повторяем попытку (максимум 3 раза)
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

        return consumer // возвращаем консюмер
      } catch (error) {
        // отладка ошибок при создании consumer
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

        // Сначала создаём consumer для нового продюсера
        const consumer = await handleCreateConsumer(data)
        if (!consumer) {
          // Если не удалось создать consumer — выходим
          return
        }
        // Обновляем consumers: удаляем старые с этим userId и добавляем новый
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
          setConsumers((prev) => {
            const newConsumers = { ...prev }
            delete newConsumers[data.producerId]
            return newConsumers
          })
        })

        consumer.on('producerclose', () => {
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
        // отладка ошибок при создании consumer
        console.error('Ошибка при создании consumer:', error) // логирование ошибок
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
    // воспроизведение звука выхода
    if (leaveSoundRef.current) {
      if (!leaveSoundRef.current.paused) {
        leaveSoundRef.current.pause()
      }

      leaveSoundRef.current.currentTime = 0
      leaveSoundRef.current.play()
    }
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
    async (cameraOn: boolean) => {
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

  // обработка изменения состояния камеры
  useEffect(() => {
    // функция обновления стрима
    const updateMedia = async () => {
      // проверяем что есть транспорт отправки, что юзер подключен к комнате, и что нужно обновлять стрим
      if (!sendTransport || !isConnected || isUpdatingMediaRef.current) {
        return
      }

      isUpdatingMediaRef.current = true // ставим, что нужно обновлять стрим

      try {
        // создаем новый стрим при изменении состояния камеры
        const newStream = await getMediaStream(isCameraOn)
        // проверка, что он создался корректно
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

        // сохраняем новый стрим - это вызовет пересоздание аудиопродюсера в хуке
        setLocalStream(newStream)

        // Логика для видео
        // если камера теперь включена и при этом нет старого продюсера камеры
        if (isCameraOn && !producersRef.current.video) {
          // получаем из нового стрима видео треки
          const videoTracks = newStream.getVideoTracks()
          // если мы их получили, то создаем продюсер для этого видео
          if (videoTracks.length > 0) {
            await createProducer(sendTransport, newStream, 'video')
          }
          // если камера выключена но она была включена
        } else if (!isCameraOn && producersRef.current.video) {
          // то закрываем продюсер и уведомляем остальных через сокет об этом
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
      } catch (error) {
        // отладка ошибок
        console.error('❌ Error in updateMedia:', error)
      } finally {
        // всегда ставим что теперь стрим не нужно обновлять, так как только что его обновили
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

  // Отрисовка других пользователей
  // Room.tsx - добавьте эти useMemo хуки

  const videoElements = useMemo(() => {
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
        const isSpeaking = speakingUsers.has(consumerData.userId)

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
                      src={consumerData.avatar || '/default-avatar.png'}
                      alt={consumerData.username || 'user'}
                      className={cl.boxAvatarBackground}
                    />
                    <img
                      src={consumerData.avatar || '/default-avatar.png'}
                      alt={consumerData.username || 'user'}
                      className={
                        isSpeaking
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
                    src={consumerData.avatar || '/default-avatar.png'}
                    alt={consumerData.username || 'User'}
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

        // Для видео - используем мемоизированный компонент
        if (isVideo) {
          return (
            <UserVideoElement
              key={producerId}
              consumerData={consumerData}
              isMuted={isMuted}
              isSpeaking={isSpeaking}
              isVideoCall={isVideoCall}
            />
          )
        }

        return null
      })
      .filter(Boolean)
  }, [consumers, mutedUsers, speakingUsers, isVideoCall, isMicroMuted])

  const localVideoElement = useMemo(() => {
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
        <LocalVideoElement
          localStream={localStream}
          isTransmitting={isTransmitting}
          isMuted={isMuted}
        />
      )
    }
  }, [
    localStream,
    isCameraOn,
    isTransmitting,
    mutedUsers,
    isVideoCall,
    isMicroMuted,
  ])
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
          {localVideoElement}
          {videoElements}
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

const UserVideoElement = React.memo(
  ({
    consumerData,
    isMuted,
    isSpeaking,
    isVideoCall,
  }: {
    consumerData: ConsumerData
    isMuted: boolean
    isSpeaking: boolean
    isVideoCall: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const trackRef = useRef<MediaStreamTrack | null>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      const track = consumerData.consumer?.track

      if (!videoElement || !track) return

      // Если трек не изменился, не делаем ничего
      if (trackRef.current === track) return

      trackRef.current = track

      // Не пересоздаем MediaStream, если videoElement.srcObject уже содержит этот трек
      if (videoElement.srcObject) {
        const currentStream = videoElement.srcObject as MediaStream
        const currentTracks = currentStream.getTracks()

        if (currentTracks.length === 1 && currentTracks[0].id === track.id) {
          return
        }

        // Останавливаем старые треки
        currentTracks.forEach((t) => t.stop())
      }

      // Создаем новый стрим только если нужно
      const newStream = new MediaStream([track])
      videoElement.srcObject = newStream

      videoElement.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error playing video:', error)
        }
      })
    }, [consumerData.consumer?.track]) // Только при реальном изменении трека
    return (
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className={isSpeaking ? cl.cameraActive : cl.camera}
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
              <img className={cl.mutedIconCam} src={mutedIcon} alt="muted" />
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
  }: {
    localStream: MediaStream | null
    isTransmitting: boolean
    isMuted: boolean
  }) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      if (videoElement && localStream) {
        videoElement.srcObject = localStream
        videoElement.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Error playing local video:', error)
          }
        })
      }
    }, [localStream]) // Только при изменении локального стрима

    if (!localStream) return null

    return (
      <div>
        <div className={cl.avatarContainer}>
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
          <video
            ref={videoRef}
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
)
