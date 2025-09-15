import { useParams } from 'react-router-dom'
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC'
import { AnimatePresence, easeInOut, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSocket } from '../../SocketContext'
import cl from './room.module.css'

export const Room = () => {
  const { id: roomID } = useParams()
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState<boolean>(false)
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false)

  const {
    clients,
    provideMediaRef,
    isSpeaking,
    setThresholdDb,
    thresholdDb,
    peerUserInfo,
  } = useWebRTC(roomID, isMicrophoneMuted, isCameraOn)

  const { socket } = useSocket()
  const currentUserId = localStorage.getItem('user-id')
  const currentUserAvatar = localStorage.getItem('avatar')

  useEffect(() => {
    socket?.emit('joinedToCall', {
      userId: currentUserId,
      roomID,
    })
  }, [socket])

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
        <button
          onClick={() => setIsCameraOn((c) => !c)}
          style={{ color: 'black', cursor: 'pointer' }}
        >
          {isCameraOn ? 'disable' : 'enable'} camera
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7vh' }}>
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
              ref={(instance) => {
                provideMediaRef(clientID, instance)
              }}
              autoPlay
              playsInline
              muted={clientID === LOCAL_VIDEO}
              style={{
                width: '0',
                // borderRadius: '1vh',
                // backgroundColor: '#000',
                // border:
                //   clientID === LOCAL_VIDEO && isSpeaking
                //     ? '1px solid lime'
                //     : '1px solid transparent',
              }}
            />
            <div className={cl.avatarContainer}>
              <AnimatePresence>
                {isSpeaking && (
                  <motion.div
                    key="waves-container"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={cl.wave1}></div>
                    <div className={cl.wave2}></div>
                    <div className={cl.wave3}></div>
                    <div className={cl.wave4}></div>
                    <div className={cl.wave5}></div>
                    <div className={cl.outline}></div>
                  </motion.div>
                )}
              </AnimatePresence>
              <img
                src={
                  clientID === LOCAL_VIDEO
                    ? currentUserAvatar
                    : // @ts-ignore
                      peerUserInfo[clientID]?.avatar || ''
                }
                alt="avatar"
                className={isSpeaking ? cl.avatarActive : cl.avatar}
              />
            </div>

            {clientID === LOCAL_VIDEO && isMicrophoneMuted && (
              <p
                style={{
                  position: 'absolute',
                }}
              >
                muted
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
