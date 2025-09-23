import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useMediaSoup } from '../../hooks/useMediaSoup'
import { useSocket } from '../../SocketContext'

interface ConsumerData {
  consumer: any
  kind: string
  userId: string
}

interface Producers {
  [key: string]: any
  audio?: any
  video?: any
}

interface Consumers {
  [producerId: string]: ConsumerData
}

export const Room = () => {
  const currentUserId = localStorage.getItem('user-id')
  const { id: roomId } = useParams()
  const [isMicroMuted, setIsMicroMuted] = useState<boolean>(false)
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [sendTransport, setSendTransport] = useState<any>(null) // переименовали для ясности
  const [producers, setProducers] = useState<Producers>({})
  const [consumers, setConsumers] = useState<Consumers>({})
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0)

  const { socket } = useSocket()
  const {
    device,
    isDeviceInitialized,
    isLoading,
    error,
    createTransports,
    createConsumer, // добавляем эту функцию из useMediaSoup
    closeTransports, // добавляем эту функцию
    fullRetry,
    reconnectAttempts: mediaSoupAttempts,
  } = useMediaSoup(roomId || '', isMicroMuted, isCameraOn)

  const producersRef = useRef<Producers>({})
  const isInitializedRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userIdRef = useRef<string>(socket?.id || '')
  const recvTransportRef = useRef<any>(null) // добавляем ref для receive transport

  useEffect(() => {
    userIdRef.current = socket?.id || ''
  }, [socket])

  // Получение медиа потока
  const getMediaStream = useCallback(
    async (cameraOn: boolean) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: !isMicroMuted
            ? {
                channelCount: 2,
                echoCancellation: true,
                noiseSuppression: true,
              }
            : false,
          video: cameraOn
            ? {
                width: 1280,
                height: 720,
                frameRate: 30,
              }
            : false,
        })
        return stream
      } catch (error) {
        console.error('Ошибка при получении медиаданных пользователя', error)
        return null
      }
    },
    [isMicroMuted]
  )

  // Создание Producer
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

        // Закрываем существующий producer
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
    []
  )

  // Функция для создания consumer с использованием правильного transport
  // Функция для создания consumer с правильной обработкой audio
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

        // Для audio consumer сразу запускаем трек
        if (consumer.kind === 'audio' && consumer.track) {
          // Создаем audio элемент для воспроизведения звука
          const audioElement = new Audio()
          audioElement.srcObject = new MediaStream([consumer.track])
          audioElement.play().catch((error) => {
            console.error('Error playing audio:', error)
          })
        }

        return consumer
      } catch (error) {
        console.error('Ошибка при создании consumer:', error)
        return null
      }
    },
    [device, createConsumer]
  )

  useEffect(() => {
    return () => {
      // Только базовая очистка, без уведомления сервера
      console.log('Component unmounting - basic cleanup')

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      // НЕ уведомляем сервер здесь - только при явном выходе
    }
  }, [])

  // Обработка новых потребителей
  useEffect(() => {
    if (!socket || !device) return

    const handleNewProducer = async (data: {
      producerId: string
      kind: string
      userId: string
    }) => {
      try {
        console.log(
          'Received new producer:',
          data.producerId,
          data.kind,
          'from user:',
          data.userId
        )

        // Не создаем consumer для собственных producers
        if (data.userId === userIdRef.current) {
          console.log('Skipping own producer')
          return
        }

        // Проверяем, не создали ли мы уже consumer для этого producer
        if (consumers[data.producerId]) {
          console.log('Consumer already exists for producer:', data.producerId)
          return
        }

        const consumer = await handleCreateConsumer(data)
        if (!consumer) {
          console.error(
            'Failed to create consumer for producer:',
            data.producerId
          )
          return
        }

        setConsumers((prev) => ({
          ...prev,
          [data.producerId]: {
            consumer,
            kind: data.kind,
            userId: data.userId,
          },
        }))

        consumer.on('transportclose', () => {
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
          setConsumers((prev) => {
            const newConsumers = { ...prev }
            delete newConsumers[data.producerId]
            return newConsumers
          })
        })
      } catch (error) {
        console.error('Ошибка при создании consumer:', error)
      }
    }

    const handleProducerClose = (data: { producerId: string }) => {
      console.log('Producer closed:', data.producerId)
      setConsumers((prev) => {
        const newConsumers = { ...prev }
        if (newConsumers[data.producerId]) {
          if (
            newConsumers[data.producerId].consumer &&
            !newConsumers[data.producerId].consumer.closed
          ) {
            newConsumers[data.producerId].consumer.close()
          }
          delete newConsumers[data.producerId]
        }
        return newConsumers
      })
    }

    // Получение списка существующих продюсеров
    const handleExistingProducers = async (
      producersList: Array<{
        producerId: string
        kind: string
        userId: string
      }>
    ) => {
      console.log('Received existing producers:', producersList)

      for (const producer of producersList) {
        if (producer.userId !== userIdRef.current) {
          await handleNewProducer(producer)
        }
      }
    }

    socket.on('new-producer', handleNewProducer)
    socket.on('producer-close', handleProducerClose)
    socket.on('existing-producers', handleExistingProducers)

    // Запрашиваем существующие продюсеры при подключении
    if (roomId && recvTransportRef.current) {
      console.log('Requesting existing producers for room:', roomId)
      socket.emit('get-producers', roomId)
    }

    return () => {
      socket.off('new-producer', handleNewProducer)
      socket.off('producer-close', handleProducerClose)
      socket.off('existing-producers', handleExistingProducers)
    }
  }, [socket, device, consumers, roomId, handleCreateConsumer])

  const leaveRoom = useCallback(async () => {
    console.log('Leaving room:', roomId)

    // Уведомляем сервер о выходе
    if (socket && roomId) {
      socket.emit('leave-room', { roomId })
    }

    // Закрываем transports
    closeTransports()

    // Закрываем local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    // Закрываем producers
    Object.values(producersRef.current).forEach((producer) => {
      if (producer && typeof producer.close === 'function') {
        producer.close()
      }
    })
    producersRef.current = {}
    setProducers({})

    // Закрываем consumers
    Object.values(consumers).forEach((consumerData) => {
      if (
        consumerData.consumer &&
        typeof consumerData.consumer.close === 'function'
      ) {
        consumerData.consumer.close()
      }
    })
    setConsumers({})

    setIsConnected(false)
    isInitializedRef.current = false
  }, [socket, roomId, localStream, consumers, closeTransports])

  useEffect(() => {
    if (!socket) return

    // Логируем все входящие события
    const originalEmit = socket.emit
    socket.emit = function (...args) {
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
      socket.emit = originalEmit
      socket.off('new-producer')
      socket.off('existing-producers')
      socket.off('producer-close')
    }
  }, [socket])

  // Основная логика подключения
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
        const stream = await getMediaStream(isCameraOn)
        if (!stream) {
          throw new Error('Failed to get media stream')
        }

        setLocalStream(stream)
        console.log('Step 5: Media stream obtained')

        console.log('Step 6: Creating producers...')
        if (!isMicroMuted) {
          await createProducer(sendTransport, stream, 'audio')
        }
        if (isCameraOn) {
          await createProducer(sendTransport, stream, 'video')
        }

        setIsConnected(true)
        setReconnectAttempts(0)
        console.log('Room initialization completed successfully')
      } catch (error) {
        console.error('Room initialization failed:', error)
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
    createTransports, // исправлено с createTransport на createTransports
    getMediaStream,
    isCameraOn,
    isMicroMuted,
    createProducer,
    reconnectAttempts,
  ])

  // Обработка изменений состояний микрофона и камеры
  useEffect(() => {
    const updateMedia = async () => {
      if (!sendTransport || !localStream || !isConnected) {
        return
      }

      try {
        const hasAudio = localStream.getAudioTracks().length > 0
        const hasVideo = localStream.getVideoTracks().length > 0

        const needNewStream =
          (isMicroMuted && hasAudio) ||
          (!isMicroMuted && !hasAudio) ||
          (!isCameraOn && hasVideo) ||
          (isCameraOn && !hasVideo)

        if (needNewStream) {
          console.log('Recreating media stream...')
          localStream.getTracks().forEach((track) => track.stop())

          const newStream = await getMediaStream(isCameraOn)
          if (!newStream) return

          setLocalStream(newStream)

          if (!isMicroMuted) {
            await createProducer(sendTransport, newStream, 'audio')
          }
          if (isCameraOn) {
            await createProducer(sendTransport, newStream, 'video')
          }
        } else {
          if (!isMicroMuted && !producersRef.current.audio) {
            const audioTracks = localStream.getAudioTracks()
            if (audioTracks.length > 0) {
              await createProducer(sendTransport, localStream, 'audio')
            }
          } else if (isMicroMuted && producersRef.current.audio) {
            if (socket && producersRef.current.audio) {
              socket.emit('producer-close', {
                producerId: producersRef.current.audio.id,
                roomId,
              })
            }
            producersRef.current.audio.close()
            producersRef.current.audio = null
            setProducers((prev) => ({ ...prev, audio: undefined }))
          }

          if (isCameraOn && !producersRef.current.video) {
            const videoTracks = localStream.getVideoTracks()
            if (videoTracks.length > 0) {
              await createProducer(sendTransport, localStream, 'video')
            }
          } else if (!isCameraOn && producersRef.current.video) {
            if (socket && producersRef.current.video) {
              socket.emit('producer-close', {
                producerId: producersRef.current.video.id,
                roomId,
              })
            }
            producersRef.current.video.close()
            producersRef.current.video = null
            setProducers((prev) => ({ ...prev, video: undefined }))
          }
        }
      } catch (error) {
        console.error('Error in updateMedia:', error)
      }
    }

    if (isConnected) {
      updateMedia()
    }
  }, [
    isMicroMuted,
    isCameraOn,
    sendTransport, // используем sendTransport вместо transport
    localStream,
    socket,
    roomId,
    isConnected,
    getMediaStream,
    createProducer,
  ])

  // Функция для полного переподключения
  const handleFullRetry = useCallback(async () => {
    console.log('Initiating full retry...')
    isInitializedRef.current = false

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Закрываем транспорты
    closeTransports()
    setSendTransport(null)
    recvTransportRef.current = null

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    Object.values(producersRef.current).forEach((producer) => {
      if (producer && typeof producer.close === 'function') {
        producer.close()
      }
    })
    producersRef.current = {}
    setProducers({})

    Object.values(consumers).forEach((consumerData) => {
      if (
        consumerData.consumer &&
        typeof consumerData.consumer.close === 'function'
      ) {
        consumerData.consumer.close()
      }
    })
    setConsumers({})

    setReconnectAttempts(0)
    setIsConnected(false)

    fullRetry()
  }, [sendTransport, localStream, closeTransports, fullRetry, consumers])

  // Отрисовка видео элементов
  const renderVideoElements = () => {
    return Object.entries(consumers)
      .map(([producerId, consumerData]) => {
        if (!consumerData.consumer || !consumerData.consumer.track) {
          return null
        }

        return (
          <video
            key={producerId}
            ref={(videoElement) => {
              if (videoElement && consumerData.consumer.track) {
                videoElement.srcObject = new MediaStream([
                  consumerData.consumer.track,
                ])
                videoElement.play().catch(console.error)
              }
            }}
            autoPlay
            playsInline
            muted={consumerData.userId === currentUserId}
            style={{
              width: '300px',
              height: '200px',
              border: '2px solid #333',
              borderRadius: '8px',
              margin: '10px',
            }}
          />
        )
      })
      .filter(Boolean)
  }

  // Локальное видео
  const renderLocalVideo = () => {
    if (!localStream) return null

    return (
      <video
        ref={(videoElement) => {
          if (videoElement) {
            videoElement.srcObject = localStream
            videoElement.play().catch(console.error)
          }
        }}
        autoPlay
        playsInline
        muted
        style={{
          width: '300px',
          height: '200px',
          border: '2px solid #007bff',
          borderRadius: '8px',
          margin: '10px',
          transform: 'scaleX(-1)',
        }}
      />
    )
  }

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
          {isMicroMuted ? '🔇 Unmute' : '🎤 Mute'}
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
          {isCameraOn ? '📷 Stop Camera' : '📹 Start Camera'}
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
          🔄 Reconnect
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
          🚪 Leave Room
        </button>
      </div>

      <div>
        <h3>Participants:</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
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
        <p>Device Initialized: {isDeviceInitialized ? '✅' : '❌'}</p>
        <p>Send Transport Ready: {sendTransport ? '✅' : '❌'}</p>
        <p>Recv Transport Ready: {recvTransportRef.current ? '✅' : '❌'}</p>
        <p>Local Stream: {localStream ? '✅' : '❌'}</p>
        <p>Audio Producer: {producers.audio ? '✅' : '❌'}</p>
        <p>Video Producer: {producers.video ? '✅' : '❌'}</p>
        <p>Consumers: {Object.keys(consumers).length}</p>
        <p>User ID: {userIdRef.current}</p>
        <p>Reconnect Attempts: {reconnectAttempts}</p>
        <p>MediaSoup Attempts: {mediaSoupAttempts}</p>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>
    </div>
  )
}
