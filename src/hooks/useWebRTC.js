import { useEffect, useRef, useCallback, useState } from 'react'
import useStateWithCallback from './useStateWithCallback'
import ACTIONS from '../backend/actions'
import { useSocket } from '../SocketContext'

export const LOCAL_VIDEO = 'LOCAL_VIDEO'

export default function useWebRTC(roomID) {
  const { socket } = useSocket()
  const [clients, updateClients] = useStateWithCallback([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [thresholdDb, setThresholdDb] = useState(-42) // разумный дефолт, можно регулировать

  const addNewClient = useCallback(
    (newClient, cb) => {
      updateClients((list) => {
        if (!list.includes(newClient)) return [...list, newClient]
        return list
      }, cb)
    },
    [updateClients]
  )

  const peerConnections = useRef({})
  const localMediaStream = useRef(null)
  const peerMediaElements = useRef({ [LOCAL_VIDEO]: null })

  const audioContext = useRef(null)
  const gainNode = useRef(null)
  const audioSource = useRef(null)
  const analyserRef = useRef(null)

  const speakingCheckInterval = useRef(null)
  const silenceTimeout = useRef(null)
  const isSpeakingRef = useRef(false)
  const thresholdRef = useRef(thresholdDb)

  // keep thresholdRef in sync so interval handler uses latest value
  useEffect(() => {
    thresholdRef.current = thresholdDb
  }, [thresholdDb])

  // === Проверка уровня звука (RMS -> dB) с гистерезисом ===
  const checkAudioLevel = useCallback(() => {
    try {
      if (!analyserRef.current || !gainNode.current || !audioContext.current)
        return

      const analyser = analyserRef.current
      const bufferLen = analyser.fftSize
      const data = new Uint8Array(bufferLen)
      analyser.getByteTimeDomainData(data) // time-domain 0..255

      // compute RMS
      let sum = 0
      for (let i = 0; i < bufferLen; i++) {
        const v = (data[i] - 128) / 128 // -1..1
        sum += v * v
      }
      const rms = Math.sqrt(sum / bufferLen)

      // avoid -Infinity; set floor
      const db = rms > 1e-8 ? 20 * Math.log10(rms) : -100

      const currentThreshold = thresholdRef.current
      const isCurrentlySpeaking = db > currentThreshold

      // immediate ON, delayed OFF (hysteresis)
      if (isCurrentlySpeaking && !isSpeakingRef.current) {
        if (silenceTimeout.current) {
          clearTimeout(silenceTimeout.current)
          silenceTimeout.current = null
        }
        isSpeakingRef.current = true
        setIsSpeaking(true)
        // fade in quickly
        gainNode.current.gain.cancelScheduledValues(
          audioContext.current.currentTime
        )
        gainNode.current.gain.setTargetAtTime(
          1.0,
          audioContext.current.currentTime,
          0.01
        )
        // debug
        // console.log('🔊 Говорит', `RMS:${rms.toFixed(5)} dB:${db.toFixed(1)} thr:${currentThreshold}`)
      }

      if (!isCurrentlySpeaking && isSpeakingRef.current) {
        // wait 150ms of silence before turning off
        if (!silenceTimeout.current) {
          silenceTimeout.current = setTimeout(() => {
            isSpeakingRef.current = false
            setIsSpeaking(false)
            gainNode.current.gain.cancelScheduledValues(
              audioContext.current.currentTime
            )
            gainNode.current.gain.setTargetAtTime(
              0.0,
              audioContext.current.currentTime,
              0.05
            )
            silenceTimeout.current = null
            // console.log('🔇 Тишина', `dB:${db.toFixed(1)} thr:${currentThreshold}`)
          }, 150)
        }
      }
    } catch (err) {
      // не ломаем всё из-за ошибок анализа
      // console.warn('checkAudioLevel error', err)
    }
  }, [])

  // === Инициализация аудио контекста и GainNode ===
  useEffect(() => {
    try {
      audioContext.current = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      })
      gainNode.current = audioContext.current.createGain()
      gainNode.current.gain.value = 0 // по умолчанию заглушено, VAD откроет при голосе
    } catch (error) {
      console.warn('Failed to initialize audio processing:', error)
    }

    return () => {
      try {
        if (speakingCheckInterval.current) {
          clearInterval(speakingCheckInterval.current)
          speakingCheckInterval.current = null
        }
        if (silenceTimeout.current) {
          clearTimeout(silenceTimeout.current)
          silenceTimeout.current = null
        }
        if (audioSource.current) {
          try {
            audioSource.current.disconnect()
          } catch (e) {}
          audioSource.current = null
        }
        if (analyserRef.current) {
          try {
            analyserRef.current.disconnect()
          } catch (e) {}
          analyserRef.current = null
        }
        if (gainNode.current) {
          try {
            gainNode.current.disconnect()
          } catch (e) {}
          gainNode.current = null
        }
        if (audioContext.current) {
          audioContext.current.close()
          audioContext.current = null
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // === Обработка аудио потока: подключаем analyser -> gain -> destination ===
  const processAudioStream = useCallback(
    async (originalStream) => {
      if (!audioContext.current || !gainNode.current) return originalStream

      try {
        // если был предыдущий источник — отсоединяем
        if (audioSource.current) {
          try {
            audioSource.current.disconnect()
          } catch (e) {}
          audioSource.current = null
        }
        if (analyserRef.current) {
          try {
            analyserRef.current.disconnect()
          } catch (e) {}
          analyserRef.current = null
        }

        // создаём источник, анализатор и destination
        audioSource.current =
          audioContext.current.createMediaStreamSource(originalStream)

        analyserRef.current = audioContext.current.createAnalyser()
        analyserRef.current.fftSize = 512
        analyserRef.current.smoothingTimeConstant = 0.3

        const audioDestination =
          audioContext.current.createMediaStreamDestination()

        // цепочка: source -> analyser -> gain -> destination
        audioSource.current.connect(analyserRef.current)
        analyserRef.current.connect(gainNode.current)
        gainNode.current.connect(audioDestination)

        // очистим старый интервал, если был
        if (speakingCheckInterval.current) {
          clearInterval(speakingCheckInterval.current)
        }
        // запуск проверки уровня
        speakingCheckInterval.current = setInterval(checkAudioLevel, 100)

        // собираем финальный поток (обработанный аудио + оригинальное видео)
        const processedStream = new MediaStream()
        audioDestination.stream
          .getAudioTracks()
          .forEach((t) => processedStream.addTrack(t))
        originalStream
          .getVideoTracks()
          .forEach((t) => processedStream.addTrack(t))

        return processedStream
      } catch (error) {
        console.error('Audio processing failed:', error)
        return originalStream
      }
    },
    [checkAudioLevel]
  )

  // --- Peer connection handlers (как в старой версии) ---
  useEffect(() => {
    async function handleNewPeer({ peerID, createOffer }) {
      if (peerID in peerConnections.current) {
        return console.warn(`Already connected to peer ${peerID}`)
      }

      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      peerConnections.current[peerID].onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: event.candidate,
          })
        }
      }

      let tracksNumber = 0
      peerConnections.current[peerID].ontrack = ({
        streams: [remoteStream],
      }) => {
        tracksNumber++
        if (tracksNumber === 2) {
          tracksNumber = 0
          addNewClient(peerID, () => {
            if (peerMediaElements.current[peerID]) {
              peerMediaElements.current[peerID].srcObject = remoteStream
            } else {
              let settled = false
              const interval = setInterval(() => {
                if (peerMediaElements.current[peerID]) {
                  peerMediaElements.current[peerID].srcObject = remoteStream
                  settled = true
                }
                if (settled) clearInterval(interval)
              }, 1000)
            }
          })
        }
      }

      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach((track) => {
          peerConnections.current[peerID].addTrack(
            track,
            localMediaStream.current
          )
        })
      }

      if (createOffer) {
        const offer = await peerConnections.current[peerID].createOffer()
        await peerConnections.current[peerID].setLocalDescription(offer)
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: offer })
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer)
    return () => socket.off(ACTIONS.ADD_PEER)
  }, [socket, addNewClient])

  useEffect(() => {
    async function setRemoteMedia({
      peerID,
      sessionDescription: remoteDescription,
    }) {
      await peerConnections.current[peerID]?.setRemoteDescription(
        new RTCSessionDescription(remoteDescription)
      )
      if (remoteDescription.type === 'offer') {
        const answer = await peerConnections.current[peerID].createAnswer()
        await peerConnections.current[peerID].setLocalDescription(answer)
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: answer })
      }
    }

    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)
    return () => socket.off(ACTIONS.SESSION_DESCRIPTION)
  }, [socket])

  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({ peerID, iceCandidate }) => {
      peerConnections.current[peerID]?.addIceCandidate(
        new RTCIceCandidate(iceCandidate)
      )
    })
    return () => socket.off(ACTIONS.ICE_CANDIDATE)
  }, [socket])

  useEffect(() => {
    const handleRemovePeer = ({ peerID }) => {
      if (peerConnections.current[peerID])
        peerConnections.current[peerID].close()
      delete peerConnections.current[peerID]
      delete peerMediaElements.current[peerID]
      updateClients((list) => list.filter((c) => c !== peerID))
    }

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer)
    return () => socket.off(ACTIONS.REMOVE_PEER)
  }, [socket, updateClients])

  // === Capture flow ===
  useEffect(() => {
    async function startCapture() {
      try {
        const originalStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: {
            width: 1280,
            height: 720,
            frameRate: 30,
          },
        })

        const finalStream = await processAudioStream(originalStream)
        localMediaStream.current = finalStream

        addNewClient(LOCAL_VIDEO, () => {
          const localVideoElement = peerMediaElements.current[LOCAL_VIDEO]
          if (localVideoElement) {
            localVideoElement.volume = 0
            localVideoElement.srcObject = finalStream
          }
        })

        socket.emit(ACTIONS.JOIN, { room: roomID })
      } catch (error) {
        console.error('Error starting media capture:', error)
      }
    }

    startCapture()

    return () => {
      if (speakingCheckInterval.current) {
        clearInterval(speakingCheckInterval.current)
        speakingCheckInterval.current = null
      }
      if (silenceTimeout.current) {
        clearTimeout(silenceTimeout.current)
        silenceTimeout.current = null
      }
      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach((track) => track.stop())
        localMediaStream.current = null
      }
      // leave room
      try {
        socket.emit(ACTIONS.LEAVE)
      } catch (e) {}
    }
  }, [roomID, socket, addNewClient, processAudioStream])

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node
  }, [])

  return {
    clients,
    provideMediaRef,
    isSpeaking,
    thresholdDb,
    setThresholdDb,
  }
}
