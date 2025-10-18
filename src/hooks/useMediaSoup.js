// Импорты
import { useState, useEffect, useCallback, useRef } from 'react'
import { Device } from 'mediasoup-client' // основной класс mediaSoup для работы с WebRTC
import { useSocket } from '../SocketContext' // Socket контекст

export const useMediaSoup = (roomId, isMicrophoneMuted, isCameraOn) => {
  const { socket } = useSocket() // Достаем Socket из контекста
  const [device, setDevice] = useState(null) // mediasoup device объект
  const [isDeviceInitialized, setIsDeviceInitialized] = useState(false) // флаг инициализации устройства
  const [isLoading, setIsLoading] = useState(false) // флаг загрузки
  const [error, setError] = useState(null) // ошибки инициализации

  // Refы транспортов
  const activeSendTransportRef = useRef(null) // ссылка на активный send транспорт
  const activeRecvTransportRef = useRef(null) // ссылка на активный receive транспорт
  const reconnectAttemptsRef = useRef(0) // счетчик попыток переподключения

  // Функция закрытия транспортов
  const closeTransports = useCallback(() => {
    if (activeSendTransportRef.current) {
      // если активный send транспорт сейчас есть
      try {
        console.log(
          'Closing send transport:',
          activeSendTransportRef.current.id
        ) // логируем попытку закрыть его
        activeSendTransportRef.current.close() // закрываем
      } catch (error) {
        // отладка ошибок
        console.error('Error closing send transport:', error)
      }
      activeSendTransportRef.current = null // очищаем ссылку на активный send транспорт
    }

    if (activeRecvTransportRef.current) {
      // если активный receive транспорт сейчас есть
      try {
        console.log(
          'Closing recv transport:',
          activeRecvTransportRef.current.id
        ) // логируем попытку закрыть его
        activeRecvTransportRef.current.close() // закрываем
      } catch (error) {
        // отладка ошибок
        console.error('Error closing recv transport:', error)
      }
      activeRecvTransportRef.current = null // очищаем ссылку на активный receive транспорт
    }
  }, []) // пустой массив зависимостей - функция очистки создается только один раз и не пересоздается при рендерах

  // Инициализация устройства
  const initDevice = useCallback(async () => {
    if (!socket || !roomId) {
      // проверка инициализированы ли сокет и айди комнаты
      setError('Socket or roomId not available')
      return
    }

    try {
      setIsLoading(true) // флаг загрузки true
      setError(null) // очистка прошлых ошибок

      closeTransports() // закрываем предыдущие транспорты

      console.log('Requesting router capabilities for room:', roomId) // логируем запрос rtp параметров для комнаты

      const response = await new Promise((resolve, reject) => {
        // промис с таймаутом 10 секунд - максимальное время ожидания ответа от сервера
        // в этом промисе мы делаем запрос rtp параметров роутера
        const timeout = setTimeout(() => {
          reject(new Error('Server response timeout'))
        }, 10000) // запускаем таймер, по истечению которого выводим, что сервер так и не ответил

        socket.emit('get-router-rtp-capabilities', { roomId }, (response) => {
          // делаем запрос rtp параметров по id комнаты
          clearTimeout(timeout) // при ответе очищаем таймер ожидания

          if (!response) {
            // ответ должен существовать
            reject(new Error('No response from server'))
            return
          }

          if (response.rtpCapabilities) {
            // у ответа должны быть rtp capabilities
            resolve(response) // выводим
          } else {
            // отладка ошибок
            reject(new Error(response.error || 'Failed to get capabilities'))
          }
        })
      })

      if (!response.rtpCapabilities) {
        // вторая проверка, что rtp capabilities есть
        throw new Error('Missing rtpCapabilities in server response')
      }

      console.log('Received router capabilities, loading device...') // логирование получения rtp и начала загрузки deviceы

      const newDevice = new Device() // создаем новый Device объект
      await newDevice.load({
        // загружаем устройство с возможностями роутера
        routerRtpCapabilities: response.rtpCapabilities,
      })

      setDevice(newDevice) // сохраняем устройство в состоянии
      setIsDeviceInitialized(true) // устанавливаем флаг инициализации девайса true
      reconnectAttemptsRef.current = 0 // сбрасываем счетчик попыток переподключения
      console.log('Device initialized successfully') // логируем успешную инициализацию устройства
    } catch (error) {
      // отладка ошибок
      console.error('Device initialization failed:', error) // логируем ошибку
      setError(error.message) // устанавливаем ошибку в состояние
      setIsDeviceInitialized(false) // сбрасываем флаг инициализации

      // Автоматический retry с экспоненциальной задержкой
      if (reconnectAttemptsRef.current < 3) {
        // максимум 3 попытки (0,1,2)
        reconnectAttemptsRef.current++ // увеличиваем количество попыток на одну
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          8000
        ) // умная задержка (2 в степени количества попыток * 1000 в миллисекундах, максимальное - 8000 миллисекунд)
        console.log(
          `Retrying device initialization in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
        ) // логируем повторую попытку

        setTimeout(() => {
          initDevice() // повторая попытка инициализировать девайс
        }, delay) // по истечению времени delay
      }
    } finally {
      setIsLoading(false) // всегда убираем состояние загрузки (хоть успешно, хоть нет)
    }
  }, [socket, roomId, closeTransports]) // зависимости

  // Создание транспортов
  const createTransports = useCallback(async () => {
    if (!socket) {
      // проверка на инициализацию сокета
      throw new Error('Socket not available')
    }
    if (!device) {
      // проверка на инициализацию девайса
      throw new Error('Device not initialized')
    }

    try {
      console.log('Creating transports for room:', roomId) // логирование создания транспортов

      closeTransports() // закрываем все прошлые транспорты

      const response = await new Promise((resolve, reject) => {
        // запрос создания транспортов
        const timeout = setTimeout(() => {
          reject(new Error('Transport creation timeout'))
        }, 15000) // ждем ответа максимум 15 секунд

        socket.emit('join-room', { roomId }, (response) => {
          // делаем запрос сокету на подключение к комнате
          clearTimeout(timeout) // очищаем таймер

          if (!response) {
            // проверка что ответ есть
            reject(new Error('No response from server for transport creation'))
            return
          }

          if (response.success && response.transportOptions) {
            // проверка что он успешный и есть настройи транспортов
            resolve(response) // возвращаем ответ
          } else {
            // отладка ошибок
            reject(new Error(response.error || 'Failed to create transports'))
          }
        })
      })

      console.log('Transport options received, creating transports...') // логирования, что получили настройки транспортов и теперь начинаем их создавать

      const sendTransport = device.createSendTransport(
        response.transportOptions.send // создаем send транспорт с полученными параметрами
      )
      activeSendTransportRef.current = sendTransport // сохраняем в ссылке на send транспорт

      // Создаем recv transport
      const recvTransport = device.createRecvTransport(
        response.transportOptions.recv // создаем receive транспорт с полученными параметрами
      )
      activeRecvTransportRef.current = recvTransport // сохраняем в ссылке на receive транспорт

      // Обработчики send transport
      sendTransport.on(
        'connect', // событие conenct - mediasoup пытается подключить send транспорт
        async ({ dtlsParameters }, callback, errback) => {
          // получаем параметры шифрования, колбек который вызывается при успешном подключении и еррбэк вызы
          try {
            console.log('Connecting send transport:', sendTransport.id) // логируем подключение send транспорта

            socket.emit(
              // уведомляем сокет о подключении send транспорта
              'connect-transport',
              {
                transportId: sendTransport.id, // отправляем его id
                dtlsParameters, // параметры шифрования
                roomId, // id комнаты
              },
              (response) => {
                // обработка получения ответа
                if (!response) {
                  // проверяем что ответ есть
                  errback(
                    new Error('No response from server for transport connect')
                  )
                  return
                }

                if (response.success) {
                  // проверяем что он успешный
                  callback() // если успешный, то вызываем колбек успешного подключения
                } else {
                  errback(
                    new Error(response.error || 'Transport connect failed')
                  )
                }
              }
            )
          } catch (error) {
            // отладка ошибок и вызов errback неуспешного подключения
            errback(error)
          }
        }
      )

      sendTransport.on('produce', async (parameters, callback, errback) => {
        // параметры с типом и параметрами шифрования, callback вызываемый при успешном ответе, errback при неуспешном
        // обработчик 'produce' - MediaSoup пытается создать producer для отправки медиа трека
        try {
          console.log('Producing track:', parameters.kind) // логируем в консоль создание producer

          socket.emit(
            // делаем запрос сокету на создание producer
            'produce',
            {
              transportId: sendTransport.id, // айди нашего send транспорта
              kind: parameters.kind, // тип (аудио или видео)
              rtpParameters: parameters.rtpParameters, // параметры шифрования
              roomId, // id комнаты
            },
            (response) => {
              // при получении ответа
              if (!response) {
                // проверяем что ответ есть
                errback(
                  new Error('No response from server for producer creation')
                )
                return
              }

              if (response.success) {
                // проверяем что он успешный
                callback({ id: response.producerId }) // вызываем callback с id созданоого producer
              } else {
                // при безуспешном ответе
                errback(new Error(response.error || 'Producer creation failed')) // вызываем errback
              }
            }
          )
        } catch (error) {
          // отладка остальных ошибок
          errback(error)
        }
      })

      // Обработчики receive transport
      recvTransport.on(
        'connect', // обработчик 'connect' для receive транспорта - аналогичен send транспорту
        async ({ dtlsParameters }, callback, errback) => {
          try {
            console.log('Connecting recv transport:', recvTransport.id)

            socket.emit(
              'connect-transport', // отправляет те же параметры на сервер
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
                  callback() // подключаем в callback receive транспорт для получения медиа
                } else {
                  errback(
                    new Error(response.error || 'Transport connect failed')
                  )
                }
              }
            )
          } catch (error) {
            // отладка ошибок
            errback(error)
          }
        }
      )

      console.log('Transports created successfully') // выводим, что все транспорты созданы успешно
      return { sendTransport, recvTransport } // возвращаем send и receive транспорты
    } catch (error) {
      console.error('Create transports failed:', error)
      closeTransports()
      throw error
    }
  }, [socket, device, roomId, closeTransports])

  // Функция создания consumer - для получения медиа
  const createConsumer = useCallback(
    async (producerId, rtpCapabilities) => {
      if (!activeRecvTransportRef.current) {
        // проверяем наличие активного receive транспорта
        throw new Error('Receive transport not available')
      }

      try {
        console.log('Creating consumer for producer:', producerId) // логируем создание consumer

        const response = await new Promise((resolve, reject) => {
          // делаем запрос на создание consumer
          socket.emit(
            'consume',
            {
              transportId: activeRecvTransportRef.current.id, // отправляем id receive транспорта
              producerId: producerId, // id продюсера, из которого мы будем делать consumer
              rtpCapabilities: rtpCapabilities, // параметры шифрования
              roomId, // id комнаты
            },
            (response) => {
              if (!response) {
                // проверка на наличие ответа
                reject(
                  new Error('No response from server for consumer creation')
                )
                return
              }

              if (response.success) {
                // если ответ успешный
                resolve(response) // возвращаем ответ сервера
              } else {
                reject(new Error(response.error || 'Consumer creation failed')) // если безуспешный - логируем ошибку
              }
            }
          )
        })

        // создаем consumer на клиенте
        const consumer = await activeRecvTransportRef.current.consume({
          // создание consumer внутри нашего receive транспорта
          id: response.consumerId, // id консюмера, который мы получили от сервера
          producerId: response.producerId, // id продюсера, который мы получили от сервера
          kind: response.kind, // тип (аудио или видео)
          rtpParameters: response.rtpParameters, // параметры шифрования
        })

        console.log('Consumer created successfully:', consumer.id) // логируем успешное создание consumer
        return consumer // возвращаем consumer
      } catch (error) {
        // отладка ошибок
        console.error('Error creating consumer:', error)
        throw error
      }
    },
    [socket, roomId] // зависимости
  )

  // Обработчик ошибок Socket
  useEffect(() => {
    if (!socket) return // проверка наличия socket

    const handleSocketError = (error) => {
      // функция обработки ошибок сокета
      console.error('Socket error:', error)
      setError('Socket connection error')
    }

    const handleDisconnect = () => {
      // функция обработки отключения сокета
      console.log('Socket disconnected')
      closeTransports()
    }

    socket.on('error', handleSocketError) // подключаем к событию
    socket.on('connect_error', handleSocketError) // подключаем к событию
    socket.on('disconnect', handleDisconnect) // подключаем к событию

    return () => {
      // cleanup обработчиков при размонтировании компонента
      socket.off('error', handleSocketError)
      socket.off('connect_error', handleSocketError)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket, closeTransports])

  // Автоматическая инициализация девайса при подключении socket
  useEffect(() => {
    if (socket && roomId && !isDeviceInitialized && !isLoading) {
      // если есть сокет и id комнаты, мы загрузились и девайс еще не инициализирован
      console.log('Initializing device...') // логируем инициализацию девайса
      initDevice() // вызываем функцию инициализации девайса
    }
  }, [socket, roomId, isDeviceInitialized, isLoading, initDevice]) // зависимости

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      closeTransports() // закрываем все транспорты при размонтировании компонента
    }
  }, [closeTransports])

  // Функция полного переподключения
  const fullRetry = useCallback(() => {
    console.log('Performing full retry...') // логируем переподключение
    reconnectAttemptsRef.current = 0 // сбрасываем количество попыток переподключения
    closeTransports() // закрываем транспорты
    setDevice(null) // сбрасываем девайс
    setIsDeviceInitialized(false) // сбрасываем state инициализации девайса
    setError(null) // сбрасываем state ошибки
    initDevice() // инициализируем девайс
  }, [initDevice, closeTransports]) // зависимости

  // что возвращает useMediaSoup
  return {
    device, // наш девайс
    isDeviceInitialized, // инициализирован ли этот девайс
    isLoading, // идет ли загрузка
    error, // state ошибки
    createTransports, // функция создания транспортов
    createConsumer, // функция создания консюмеров
    initDevice, // функция инициализации девайса
    closeTransports, // функция закрытия транспортов
    fullRetry, // функция полного переподключения
    reconnectAttempts: reconnectAttemptsRef.current, // счетчик количества попыток переподключения
  }
}
