import { useCallback, useEffect, useRef, useState } from 'react'

// кастомный хук для определения громкости и возвращения, говорит ли человек, или нет
export const useAudioVolume = (
  stream: MediaStream | null, // получаем локальный стрим, из которого будем доставать аудио дорожку
  threshold: number // и получаем чувствительность
) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false) // состояние, говорит ли сейчас человек (которое мы после будем возвращать)
  const intervalRef = useRef<NodeJS.Timeout | null>(null) // реф интервала для проверки (каждые 30мс проверяем на то, говорит или нет)
  const audioContextRef = useRef<AudioContext | null>(null) // реф аудио контекста - движок для работы с аудио в браузере
  const analyserRef = useRef<AnalyserNode | null>(null) // реф анализатора - инструмент для анализа аудио данных

  useEffect(() => {
    console.log(isSpeaking)
  }, [isSpeaking])

  // эффект - запускается, когда меняется локальный стрим или чувствительность
  useEffect(() => {
    if (!stream) {
      // если локального стрима нет
      setIsSpeaking(false) // то сохраняем, что юзер не говорит
      return // пустой returnы
    }

    const audioTracks = stream.getAudioTracks() // получаем аудио трек из нашего локального стрима
    if (audioTracks.length === 0) {
      // если локального аудио трека нет
      setIsSpeaking(false) // сохраняем, что юзер не говорит
      return // пустой return
    }

    try {
      const audioContext = new AudioContext() // создаем аудио контект
      audioContextRef.current = audioContext // сохраняем его в рефке

      const analyser = audioContext.createAnalyser() // создаем анализатор
      analyser.fftSize = 256 // задаем ему точность анализа (чем больше, тем точнее, но медленнее)
      analyserRef.current = analyser // сохраняем анализатор в рефке

      const source = audioContext.createMediaStreamSource(stream) // берем аудио поток из локального стрима
      source.connect(analyser) // подключаем его к анализатору

      const dataArray = new Uint8Array(analyser.frequencyBinCount) // создаем массив для данных - в него анализатор будет записывать громкость (0-255)

      // запускаем периодическую проверку
      intervalRef.current = setInterval(() => {
        if (!analyserRef.current) return // если анализатора нет - пустой returnы

        analyserRef.current.getByteFrequencyData(dataArray) // получаем данные о громкости

        // анализируем средние частоты - в них речь
        let sum = 0
        for (let i = 1; i < 48; i++) {
          sum += dataArray[i] // суммируем громкость на всех частотах
        }

        const average = sum / 48 // вычисляем среднюю громкость на средних частотах
        const db = average > 0 ? 20 * Math.log10(average / 255) : -100 // преобразуем в децибелы

        // определяем речь
        setIsSpeaking(db > threshold) // если громкость больше чем чувствительность - юзер говорит, иначе - молчит
      }, 30)
    } catch (error) {
      console.error('Audio analysis error:', error) // обработка ошибок
    }

    // cleanup при уничтожении компонента, изменении чувствительности или локального стрима
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current) // если работает интервал - очищаем его
      if (audioContextRef.current)
        // если есть аудио контекст (движок для работы со звуком) - закрываем его
        audioContextRef.current.close().catch(() => {})
    }
  }, [stream, threshold])

  return { isSpeaking } // возвращаем, говорит ли юзер, или нет
}

interface AudioControlProps {
  isSpeaking: boolean
  isMicroMuted: boolean
  sendTransport: any
  producersRef: any
  isConnected: boolean
  localStream: MediaStream | null
  createProducer: (
    transport: any,
    stream: MediaStream,
    kind: string
  ) => Promise<any>
}

export const useAudioControl = ({
  isSpeaking,
  isMicroMuted,
  sendTransport,
  producersRef,
  isConnected,
  localStream,
  createProducer,
}: AudioControlProps) => {
  const [isTransmitting, setIsTransmitting] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const processedStreamRef = useRef<MediaStream | null>(null)
  const isInitializedRef = useRef(false)

  // Создаем обработанный стрим с GainNode
  const createProcessedStream = useCallback(
    async (originalStream: MediaStream): Promise<MediaStream> => {
      if (!originalStream) throw new Error('No original stream provided')

      // Создаем AudioContext
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      // Создаем GainNode для управления громкостью
      const gainNode = audioContext.createGain()
      gainNodeRef.current = gainNode

      // Начальная громкость - 0 (молчим)
      gainNode.gain.value = 0

      // Создаем источник из оригинального стрима
      const source = audioContext.createMediaStreamSource(originalStream)

      // Создаем destination для вывода
      const destination = audioContext.createMediaStreamDestination()

      // Подключаем цепочку: source -> gainNode -> destination
      source.connect(gainNode)
      gainNode.connect(destination)

      return destination.stream
    },
    []
  )

  // Управление громкостью
  const setAudioVolume = useCallback((volume: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
      console.log(`🔊 Audio volume set to: ${Math.round(volume * 100)}%`)
    }
  }, [])

  // Основная логика
  useEffect(() => {
    const shouldTransmit = !isMicroMuted && isSpeaking
    const targetVolume = shouldTransmit ? 1.0 : 0.0

    // Меняем громкость, если GainNode уже инициализирован
    if (isInitializedRef.current && gainNodeRef.current) {
      setAudioVolume(targetVolume)
      setIsTransmitting(shouldTransmit)
      return
    }

    // Инициализация: создаем продюсер с обработанным стримом
    const initializeAudioProducer = async () => {
      if (
        !sendTransport ||
        !localStream ||
        !isConnected ||
        isInitializedRef.current
      )
        return

      try {
        console.log('🎤 Initializing audio producer with GainNode...')

        // Создаем обработанный стрим с GainNode
        const processedStream = await createProcessedStream(localStream)
        processedStreamRef.current = processedStream

        // Создаем продюсер с обработанным стримом
        await createProducer(sendTransport, processedStream, 'audio')

        // Устанавливаем начальную громкость
        setAudioVolume(targetVolume)
        setIsTransmitting(shouldTransmit)
        isInitializedRef.current = true

        console.log('✅ Audio producer with GainNode initialized successfully')
      } catch (error) {
        console.error(
          '❌ Failed to initialize audio producer with GainNode:',
          error
        )
      }
    }

    initializeAudioProducer()
  }, [
    isSpeaking,
    isMicroMuted,
    sendTransport,
    localStream,
    isConnected,
    createProcessedStream,
    setAudioVolume,
    createProducer,
  ])

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
      }
    }
  }, [])

  return { isTransmitting, setAudioVolume }
}
