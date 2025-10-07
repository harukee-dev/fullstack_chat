import { useEffect, useRef, useState } from 'react'

// Добавьте этот хук в файл
export const useAudioVolume = (
  stream: MediaStream | null,
  interval: number = 100
) => {
  const [volumeDb, setVolumeDb] = useState<number>(-Infinity)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!stream) {
      setVolumeDb(-Infinity)
      setIsSpeaking(false)
      return
    }

    // Проверяем есть ли аудио-треки
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setVolumeDb(-Infinity)
      setIsSpeaking(false)
      return
    }

    try {
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      intervalRef.current = setInterval(() => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }

        const average = sum / dataArray.length
        const normalizedVolume = average / 255

        const db =
          normalizedVolume > 0 ? 20 * Math.log10(normalizedVolume) : -Infinity

        setVolumeDb(db)
        setIsSpeaking(db > -25) // Порог -40 dB для определения речи
      }, interval)
    } catch (error) {
      console.error('Error setting up audio analysis:', error)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stream, interval])

  return { volumeDb, isSpeaking }
}
