import { useEffect, useRef, useState } from 'react'

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

        const average = sum / 12 // вычисляем среднюю громкость на средних частотах
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
