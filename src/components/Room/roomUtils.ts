import { useCallback, useEffect, useRef, useState } from 'react'

// кастомный хук для определения громкости и возвращения, говорит ли человек, или нет
export const useAudioVolume = (
  stream: MediaStream | null, // входной медиастрим (микрофон)
  threshold: number // порог громкости для определения речи
) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false) // создаем состояние, говорит юзер или нет
  const intervalRef = useRef<NodeJS.Timeout | null>(null) // ссылка на интервал для периодического анализа звука микрофона
  const audioContextRef = useRef<AudioContext | null>(null) // ссылка на аудио контекст (движок Web Audio API)
  const analyserRef = useRef<AnalyserNode | null>(null) // ссылка на анализатор звука
  const currentStreamIdRef = useRef<string>('') // ссылка на айди текущего стрима

  // Сброс анализатора при смене стрима
  // отслеживает изменение медиастрима, если стрим изменился - полностью очищает старый анализатор и сбрасывает состояние isSpeaking на false
  useEffect(() => {
    if (!stream) {
      // если стрима нет
      setIsSpeaking(false) // то isSpeaking false
      return // и делаем пустой return, чтобы не продолжать функцию
    }

    const streamId = stream.id // достаем айди стрима
    if (streamId !== currentStreamIdRef.current) {
      // если айди стрима поменялся

      // Очищаем старый анализатор
      if (intervalRef.current) {
        // если интервал работает
        clearInterval(intervalRef.current) // то очищаем его
        intervalRef.current = null // и очищаем ссылку на интервал
      }
      if (audioContextRef.current) {
        // если аудио контект инициализирован
        audioContextRef.current.close().catch(() => {}) // закрываем его
        audioContextRef.current = null // очищаем ссылку на него
      }
      analyserRef.current = null // сбрасываем ссылку на анализатор

      currentStreamIdRef.current = streamId // обновляем ссылку на текущий стрим
      setIsSpeaking(false) // задаем состояние isSpeaking false (юзер не говорит)
    }
  }, [stream]) // в зависимостях стрим - когда он меняется, useEffect срабатывает повторно

  useEffect(() => {
    if (!stream) {
      // если стрима нет, то заканчиваем функцию и задаем isSpeaking false
      setIsSpeaking(false)
      return
    }

    const audioTracks = stream.getAudioTracks() // получаем аудио треки из нашего локального стрима
    if (audioTracks.length === 0) {
      // если нет аудио треков, то заканчиваем функцию и задаем isSpeaking false
      setIsSpeaking(false)
      return
    }

    const audioTrack = audioTracks[0] // достаем первый аудио трек (он всегда должен быть только один)
    if (audioTrack.readyState === 'ended') {
      // если этот трек уже закончил свою работу - конец работы
      setIsSpeaking(false)
      return
    }

    if (intervalRef.current && audioContextRef.current) {
      // если интервал и аудио контекст уже инициализированы - то мы заканчиваем функцию, тк уже все работает
      return
    }

    try {
      const audioContext = new AudioContext() // создаем новый аудио контекст
      audioContextRef.current = audioContext // сохраняем ссылку на него для быстрого доступа

      const analyser = audioContext.createAnalyser() // создаем анализатор
      analyser.fftSize = 256 // задаем ему размер - чем больше, тем четче он будет работать
      analyserRef.current = analyser // сохраняем ссылку на анализатор для быстрого доступа

      const source = audioContext.createMediaStreamSource(stream) // создаем source из нашего стрима - через него мы будем подключать стрим к анализатору
      source.connect(analyser) // подключаем стрим к анализатору

      const dataArray = new Uint8Array(analyser.frequencyBinCount) // создаем массив для хранения данных о частотах - из него мы будем брать громкость нашего юзера

      intervalRef.current = setInterval(() => {
        // создаем интервал, чтобы каждый отрезок времени анализировать громкость
        if (!analyserRef.current) return // проверка, что анализатор инициализирован

        analyserRef.current.getByteFrequencyData(dataArray) // получаем данные о частотах (0-255)

        // суммируем значение средних частот (1-48) - это диапазон человеческой речиыф
        let sum = 0
        for (let i = 1; i < 48; i++) {
          sum += dataArray[i]
        }

        const average = sum / 48 // вычисляем среднее значение
        const db = average > 0 ? 20 * Math.log10(average / 255) : -100 // преобразуем в децибелы через константную формулу преобразования

        setIsSpeaking(db > threshold) // сравниваем с порогом threshold и устанавливаем isSpeakings
      }, 30)
    } catch (error) {
      // отладка ошибок
      console.error('Audio analysis error:', error)
    }

    // cleanup функция
    return () => {
      if (intervalRef.current) {
        // если интервал инициализирован
        clearInterval(intervalRef.current) // очищаем интервал
        intervalRef.current = null // очищаем ссылку на него
      }
      if (audioContextRef.current) {
        // если аудио контекст инициализирован
        audioContextRef.current.close().catch(() => {}) // закрываем аудио контекст
        audioContextRef.current = null // очищаем ссылку на него
      }
    }
  }, [stream, threshold]) // зависимости - стрим и порог threshold

  return { isSpeaking } // вся функция useAudioVolume возвращает isSpeaking - говорит ли юзер или нет (в независимости от того, замучен он или нет)
}

// интерфейс хука useAudioControl()
interface AudioControlProps {
  isSpeaking: boolean // говорил пользователь или нет
  isMicroMuted: boolean // замучен микрофон пользователя или нет
  sendTransport: any // транспорт для отправки медиа
  producersRef: any // ссылка на продюсеры
  isConnected: boolean // подключен ли пользователь к комнате
  localStream: MediaStream | null // локальный медиа стрим
  createProducer: (
    // функция создания продюсера
    transport: any,
    stream: MediaStream,
    kind: string
  ) => Promise<any>
  socket: any // сокет
  roomId: any // id текущей комнаты
}

export const useAudioControl = ({
  isSpeaking,
  isMicroMuted,
  sendTransport,
  producersRef,
  isConnected,
  localStream,
  createProducer,
  socket,
  roomId,
}: AudioControlProps) => {
  const [isTransmitting, setIsTransmitting] = useState(false) // состояние, отправляется ли звук (то есть говорит ли человек + не замучен ли его микрофон)
  const audioContextRef = useRef<AudioContext | null>(null) // ссылка на аудио контекст
  const gainNodeRef = useRef<GainNode | null>(null) // ссылка на GainNode для управления громкостью
  const processedStreamRef = useRef<MediaStream | null>(null) // обработанный стрим с регулируемой громкостью

  // Управление громкостью
  const setAudioVolume = useCallback((volume: number) => {
    // получаем громкость
    if (gainNodeRef.current) {
      // если gainnode инициализирован
      gainNodeRef.current.gain.value = volume // меняем громкость на ту, которую принимаем
      setIsTransmitting(volume > 0) // проверяем, больше ли она 0, если да - то звук отправляется
    }
  }, [])

  // Создание обработанного стрима с GainNode
  const createProcessedStream = useCallback(
    async (originalStream: MediaStream) => {
      // принимаем оригиналный локальный медиа стрим
      try {
        // Закрываем старый AudioContext
        if (audioContextRef.current) {
          // если аудио контекст инициализирован
          audioContextRef.current.close().catch(console.error) // закрываем его
          audioContextRef.current = null // очищаем ссылку на него
        }
        gainNodeRef.current = null // очищаем ссылку на gainNode

        const audioContext = new AudioContext() // создаем новый аудио контекст
        audioContextRef.current = audioContext // сохраняем ссылку на него

        const gainNode = audioContext.createGain() // создаем gainNode
        gainNodeRef.current = gainNode // сохраняем ссылку на него
        gainNode.gain.value = 0 // начальная громкость = 0

        const source = audioContext.createMediaStreamSource(originalStream) // создаем source для соединения стрим-gainNode
        const destination = audioContext.createMediaStreamDestination()

        source.connect(gainNode) // подключаем
        gainNode.connect(destination) // подключаем

        return destination.stream // возвращаем обработанный стрим
      } catch (error) {
        // отладка ошибок
        console.error('Error creating processed stream:', error)
        return originalStream // возвращаем обычный стрим, если возникла ошибка при создании обработанного
      }
    },
    []
  )

  // создание аудиопродюсера
  const createAudioProducer = useCallback(async () => {
    if (!sendTransport || !localStream || !isConnected) {
      // проверка на то, что есть транспорт отправки медиа, локальный стрим, и что пользователь подключен к комнате
      return false
    }

    try {
      const processedStream = await createProcessedStream(localStream) // создаем обработанный стрим нашей функцией
      processedStreamRef.current = processedStream // сохраняем ссылку на обработанный стрим

      if (producersRef.current.audio) {
        // Отправляем событие о закрытии старого продюсера, с проверкой того, что все есть (сокет, айди комнаты, айди аудио продюсера)
        if (socket && roomId && producersRef.current.audio.id) {
          socket.emit('producer-close', {
            producerId: producersRef.current.audio.id,
            roomId: roomId,
          })
        }
        producersRef.current.audio.close() // закрываем аудио продюсер
        producersRef.current.audio = null // очищаем ссылку на него
      }

      // создаем новый продюсер
      const audioProducer = await createProducer(
        sendTransport,
        processedStream,
        'audio'
      )
      if (!audioProducer) {
        // проверка, что он создался
        throw new Error('Failed to create audio producer')
      }

      return true // возвращаем true если создался
    } catch (error) {
      // отладка ошибок
      return false
    }
  }, [
    sendTransport,
    localStream,
    isConnected,
    createProcessedStream,
    createProducer,
    producersRef,
    socket,
    roomId,
  ]) // зависимости

  // useEffect пересоздания продюсера при изменении стрима (если например включилась или выключилась вебка и подобное)
  useEffect(() => {
    let isMounted = true

    const initializeAudio = async () => {
      // функция инициализации аудио
      if (!localStream || !sendTransport || !isConnected) {
        // проверка, что есть локальный стрим, транспорт отправки и юзер подключен к комнате
        return
      }

      const success = await createAudioProducer() // создаем аудио продюсер нашей функцией (success будет равна true или false в зависимости от того, создался ли продюсер)

      if (isMounted && success) {
        // если все в порядке
        const shouldTransmit = !isMicroMuted && isSpeaking // проверяем, нужно ли изначально передавать звук
        const targetVolume = shouldTransmit ? 1.0 : 0.0 // в зависимости от этого мы вычисляем громкость
        setAudioVolume(targetVolume) // и выставляем эту громкость нашему аудио
      }
    }

    initializeAudio() // вызываем функцию инициализации аудио

    // cleanup
    return () => {
      isMounted = false
    }
  }, [localStream?.id, sendTransport, isConnected]) // зависимости

  // useEffect для управления громкостью
  useEffect(() => {
    if (gainNodeRef.current) {
      // если gainNode инициализирован
      const shouldTransmit = !isMicroMuted && isSpeaking // проверка на то, нужно ли передавать звук
      const targetVolume = shouldTransmit ? 1.0 : 0.0 // вычисление громкости
      setAudioVolume(targetVolume) // задаем громкость
    }
  }, [isSpeaking, isMicroMuted, setAudioVolume]) // зависимости

  // cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
      }
    }
  }, [])

  return { isTransmitting } // возвращаем стейт - передается звук или нет
}
