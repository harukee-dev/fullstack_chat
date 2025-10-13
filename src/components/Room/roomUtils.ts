import { useCallback, useEffect, useRef, useState } from 'react'

// кастомный хук для определения громкости и возвращения, говорит ли человек, или нет
export const useAudioVolume = (
  stream: MediaStream | null,
  threshold: number
) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const currentStreamIdRef = useRef<string>('')

  // Сброс анализатора при смене стрима
  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false)
      return
    }

    const streamId = stream.id
    if (streamId !== currentStreamIdRef.current) {
      console.log('🔄 Stream changed in useAudioVolume, resetting analysis')

      // Очищаем старый анализатор
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null

      currentStreamIdRef.current = streamId
      setIsSpeaking(false)
    }
  }, [stream])

  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false)
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setIsSpeaking(false)
      return
    }

    const audioTrack = audioTracks[0]
    if (audioTrack.readyState === 'ended') {
      setIsSpeaking(false)
      return
    }

    if (intervalRef.current && audioContextRef.current) {
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
        for (let i = 1; i < 48; i++) {
          sum += dataArray[i]
        }

        const average = sum / 48
        const db = average > 0 ? 20 * Math.log10(average / 255) : -100

        setIsSpeaking(db > threshold)
      }, 30)
    } catch (error) {
      console.error('Audio analysis error:', error)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [stream, threshold])

  return { isSpeaking }
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
  socket: any
  roomId: any
}

// roomUtils.ts - полностью переработанный хук
export const useAudioControl = ({
  isSpeaking,
  isMicroMuted,
  sendTransport,
  producersRef,
  isConnected,
  localStream,
  createProducer,
  socket, // Добавьте
  roomId, // Добавьте
}: AudioControlProps) => {
  const [isTransmitting, setIsTransmitting] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const processedStreamRef = useRef<MediaStream | null>(null)

  // Управление громкостью
  const setAudioVolume = useCallback((volume: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
      console.log(`🔊 Audio volume set to: ${Math.round(volume * 100)}%`)
      setIsTransmitting(volume > 0)
    }
  }, [])

  // Создание обработанного стрима с GainNode
  const createProcessedStream = useCallback(
    async (originalStream: MediaStream) => {
      try {
        // Закрываем старый AudioContext
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error)
          audioContextRef.current = null
        }
        gainNodeRef.current = null

        // Создаем новый AudioContext
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext

        const gainNode = audioContext.createGain()
        gainNodeRef.current = gainNode
        gainNode.gain.value = 0 // Начальная громкость - 0

        const source = audioContext.createMediaStreamSource(originalStream)
        const destination = audioContext.createMediaStreamDestination()

        source.connect(gainNode)
        gainNode.connect(destination)

        console.log('✅ Processed stream created with GainNode')
        return destination.stream
      } catch (error) {
        console.error('Error creating processed stream:', error)
        return originalStream
      }
    },
    []
  )

  // Создание аудиопродюсера
  const createAudioProducer = useCallback(async () => {
    if (!sendTransport || !localStream || !isConnected) {
      console.log('❌ Cannot create audio producer: missing dependencies')
      return false
    }

    try {
      console.log('🎤 Creating audio producer with GainNode...')

      // Создаем обработанный стрим
      const processedStream = await createProcessedStream(localStream)
      processedStreamRef.current = processedStream

      // Закрываем старый аудио продюсер
      if (producersRef.current.audio) {
        console.log('🔄 Closing old audio producer')
        // Отправляем событие о закрытии старого продюсера
        if (socket && roomId && producersRef.current.audio.id) {
          socket.emit('producer-close', {
            producerId: producersRef.current.audio.id,
            roomId: roomId,
          })
        }
        producersRef.current.audio.close()
        producersRef.current.audio = null
      }

      // Создаем новый продюсер
      const audioProducer = await createProducer(
        sendTransport,
        processedStream,
        'audio'
      )
      if (!audioProducer) {
        throw new Error('Failed to create audio producer')
      }

      console.log('✅ Audio producer with GainNode created successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to create audio producer with GainNode:', error)
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
  ])

  // Основной эффект - пересоздаем аудиопродюсер при изменении стрима
  useEffect(() => {
    let isMounted = true

    const initializeAudio = async () => {
      if (!localStream || !sendTransport || !isConnected) {
        return
      }

      console.log('🔄 Initializing/reinitializing audio producer...')
      const success = await createAudioProducer()

      if (isMounted && success) {
        // Устанавливаем начальную громкость
        const shouldTransmit = !isMicroMuted && isSpeaking
        const targetVolume = shouldTransmit ? 1.0 : 0.0
        setAudioVolume(targetVolume)
      }
    }

    initializeAudio()

    return () => {
      isMounted = false
    }
  }, [localStream?.id, sendTransport, isConnected])

  // Эффект для управления громкостью
  useEffect(() => {
    if (gainNodeRef.current) {
      const shouldTransmit = !isMicroMuted && isSpeaking
      const targetVolume = shouldTransmit ? 1.0 : 0.0
      setAudioVolume(targetVolume)
    }
  }, [isSpeaking, isMicroMuted, setAudioVolume])

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
      }
    }
  }, [])

  return { isTransmitting }
}
