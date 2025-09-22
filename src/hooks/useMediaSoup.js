// hooks/useMediaSoup.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { Device } from 'mediasoup-client'
import { useSocket } from '../SocketContext'

export const useMediaSoup = (roomId, isMicrophoneMuted, isCameraOn) => {
  const { socket } = useSocket()
  const [device, setDevice] = useState(null)
  const [isDeviceInitialized, setIsDeviceInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const activeSendTransportRef = useRef(null)
  const activeRecvTransportRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)

  // Функция для закрытия транспортов
  const closeTransports = useCallback(() => {
    if (activeSendTransportRef.current) {
      try {
        console.log(
          'Closing send transport:',
          activeSendTransportRef.current.id
        )
        activeSendTransportRef.current.close()
      } catch (error) {
        console.error('Error closing send transport:', error)
      }
      activeSendTransportRef.current = null
    }

    if (activeRecvTransportRef.current) {
      try {
        console.log(
          'Closing recv transport:',
          activeRecvTransportRef.current.id
        )
        activeRecvTransportRef.current.close()
      } catch (error) {
        console.error('Error closing recv transport:', error)
      }
      activeRecvTransportRef.current = null
    }
  }, [])

  // Инициализация устройства
  const initDevice = useCallback(async () => {
    if (!socket || !roomId) {
      setError('Socket or roomId not available')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Закрываем предыдущие транспорты если есть
      closeTransports()

      console.log('Requesting router capabilities for room:', roomId)

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server response timeout'))
        }, 10000)

        socket.emit('get-router-rtp-capabilities', { roomId }, (response) => {
          clearTimeout(timeout)

          if (!response) {
            reject(new Error('No response from server'))
            return
          }

          if (response.rtpCapabilities) {
            resolve(response)
          } else {
            reject(new Error(response.error || 'Failed to get capabilities'))
          }
        })
      })

      if (!response.rtpCapabilities) {
        throw new Error('Missing rtpCapabilities in server response')
      }

      console.log('Received router capabilities, loading device...')

      const newDevice = new Device()
      await newDevice.load({
        routerRtpCapabilities: response.rtpCapabilities,
      })

      setDevice(newDevice)
      setIsDeviceInitialized(true)
      reconnectAttemptsRef.current = 0
      console.log('Device initialized successfully')
    } catch (error) {
      console.error('Device initialization failed:', error)
      setError(error.message)
      setIsDeviceInitialized(false)

      // Автоматический retry с экспоненциальной задержкой
      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current++
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          8000
        )
        console.log(
          `Retrying device initialization in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
        )

        setTimeout(() => {
          initDevice()
        }, delay)
      }
    } finally {
      setIsLoading(false)
    }
  }, [socket, roomId, closeTransports])

  // Создание транспортов
  const createTransports = useCallback(async () => {
    if (!socket) {
      throw new Error('Socket not available')
    }
    if (!device) {
      throw new Error('Device not initialized')
    }

    try {
      console.log('Creating transports for room:', roomId)

      // Закрываем предыдущие транспорты перед созданием новых
      closeTransports()

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Transport creation timeout'))
        }, 15000)

        socket.emit('join-room', { roomId, userId: socket.id }, (response) => {
          clearTimeout(timeout)

          if (!response) {
            reject(new Error('No response from server for transport creation'))
            return
          }

          if (response.success && response.transportOptions) {
            resolve(response)
          } else {
            reject(new Error(response.error || 'Failed to create transports'))
          }
        })
      })

      console.log('Transport options received, creating transports...')

      // Создаем send transport
      const sendTransport = device.createSendTransport(
        response.transportOptions.send
      )
      activeSendTransportRef.current = sendTransport

      // Создаем recv transport
      const recvTransport = device.createRecvTransport(
        response.transportOptions.recv
      )
      activeRecvTransportRef.current = recvTransport

      // Обработчики send transport
      sendTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          try {
            console.log('Connecting send transport:', sendTransport.id)

            socket.emit(
              'connect-transport',
              {
                transportId: sendTransport.id,
                dtlsParameters,
                roomId,
              },
              (response) => {
                if (!response) {
                  errback(
                    new Error('No response from server for transport connect')
                  )
                  return
                }

                if (response.success) {
                  callback()
                } else {
                  errback(
                    new Error(response.error || 'Transport connect failed')
                  )
                }
              }
            )
          } catch (error) {
            errback(error)
          }
        }
      )

      sendTransport.on('produce', async (parameters, callback, errback) => {
        try {
          console.log('Producing track:', parameters.kind)

          socket.emit(
            'produce',
            {
              transportId: sendTransport.id,
              kind: parameters.kind,
              rtpParameters: parameters.rtpParameters,
              roomId,
            },
            (response) => {
              if (!response) {
                errback(
                  new Error('No response from server for producer creation')
                )
                return
              }

              if (response.success) {
                callback({ id: response.producerId })
              } else {
                errback(new Error(response.error || 'Producer creation failed'))
              }
            }
          )
        } catch (error) {
          errback(error)
        }
      })

      // Обработчики recv transport
      recvTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          try {
            console.log('Connecting recv transport:', recvTransport.id)

            socket.emit(
              'connect-transport',
              {
                transportId: recvTransport.id,
                dtlsParameters,
                roomId,
              },
              (response) => {
                if (!response) {
                  errback(
                    new Error('No response from server for transport connect')
                  )
                  return
                }

                if (response.success) {
                  callback()
                } else {
                  errback(
                    new Error(response.error || 'Transport connect failed')
                  )
                }
              }
            )
          } catch (error) {
            errback(error)
          }
        }
      )

      console.log('Transports created successfully')
      return { sendTransport, recvTransport }
    } catch (error) {
      console.error('Create transports failed:', error)
      closeTransports()
      throw error
    }
  }, [socket, device, roomId, closeTransports])

  // Функция для создания consumer
  const createConsumer = useCallback(
    async (producerId, rtpCapabilities) => {
      if (!activeRecvTransportRef.current) {
        throw new Error('Receive transport not available')
      }

      try {
        console.log('Creating consumer for producer:', producerId)

        const response = await new Promise((resolve, reject) => {
          socket.emit(
            'consume',
            {
              transportId: activeRecvTransportRef.current.id,
              producerId: producerId,
              rtpCapabilities: rtpCapabilities,
              roomId,
            },
            (response) => {
              if (!response) {
                reject(
                  new Error('No response from server for consumer creation')
                )
                return
              }

              if (response.success) {
                resolve(response)
              } else {
                reject(new Error(response.error || 'Consumer creation failed'))
              }
            }
          )
        })

        // Создаем consumer на клиенте
        const consumer = await activeRecvTransportRef.current.consume({
          id: response.consumerId,
          producerId: response.producerId,
          kind: response.kind,
          rtpParameters: response.rtpParameters,
        })

        console.log('Consumer created successfully:', consumer.id)
        return consumer
      } catch (error) {
        console.error('Error creating consumer:', error)
        throw error
      }
    },
    [socket, roomId]
  )

  // Добавляем обработчик ошибок socket
  useEffect(() => {
    if (!socket) return

    const handleSocketError = (error) => {
      console.error('Socket error:', error)
      setError('Socket connection error')
    }

    const handleDisconnect = () => {
      console.log('Socket disconnected')
      closeTransports()
    }

    socket.on('error', handleSocketError)
    socket.on('connect_error', handleSocketError)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('error', handleSocketError)
      socket.off('connect_error', handleSocketError)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket, closeTransports])

  // Автоматическая инициализация при подключении socket
  useEffect(() => {
    if (socket && roomId && !isDeviceInitialized && !isLoading) {
      console.log('Initializing device...')
      initDevice()
    }
  }, [socket, roomId, isDeviceInitialized, isLoading, initDevice])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      closeTransports()
    }
  }, [closeTransports])

  // Функция для полного переподключения
  const fullRetry = useCallback(() => {
    console.log('Performing full retry...')
    reconnectAttemptsRef.current = 0
    closeTransports()
    setDevice(null)
    setIsDeviceInitialized(false)
    setError(null)
    initDevice()
  }, [initDevice, closeTransports])

  return {
    device,
    isDeviceInitialized,
    isLoading,
    error,
    createTransports,
    createConsumer,
    initDevice,
    closeTransports,
    fullRetry,
    reconnectAttempts: reconnectAttemptsRef.current,
  }
}
