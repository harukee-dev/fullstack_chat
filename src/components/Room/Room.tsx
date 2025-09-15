import { useParams } from 'react-router-dom'
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC'
import { easeInOut, motion } from 'framer-motion'
import { useState } from 'react'

export const Room = () => {
  const { id: roomID } = useParams()
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState<boolean>(false)

  const { clients, provideMediaRef, isSpeaking, setThresholdDb, thresholdDb } =
    useWebRTC(roomID, isMicrophoneMuted)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1vh',
        justifyContent: 'center',
        alignItems: 'center',
        height: '90vh',
      }}
    >
      <h1>Room {roomID}</h1>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1vh',
        }}
      >
        <p>{thresholdDb}dB</p>
        <input
          id="threshold"
          type="range"
          min="-60"
          max="0"
          step="1"
          onChange={(e) => setThresholdDb(parseInt(e.target.value))}
          style={{ width: '300px' }}
        />
        <button
          onClick={() => setIsMicrophoneMuted((m) => !m)}
          style={{ color: 'black', cursor: 'pointer' }}
        >
          {isMicrophoneMuted ? 'unmute' : 'mute'} microphone
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1vh' }}>
        {clients.map((clientID: string) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              ease: easeInOut,
              delay: 0.2,
              layout: {
                duration: 0.3,
                ease: easeInOut,
              },
            }}
            key={clientID}
          >
            <video
              ref={(instance) => provideMediaRef(clientID, instance)}
              autoPlay
              playsInline
              muted={clientID === LOCAL_VIDEO}
              style={{
                width: '30vw',
                borderRadius: '1vh',
                backgroundColor: '#000',
                border: isSpeaking ? '1px solid lime' : '1px solid transparent',
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
