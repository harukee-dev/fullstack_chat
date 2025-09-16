import { useParams } from 'react-router-dom'
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC'
import { AnimatePresence, easeInOut, motion } from 'framer-motion'
import { useEffect, useState, useCallback } from 'react'
import { useSocket } from '../../SocketContext'
import cl from './room.module.css'
import mutedMicrophoneIcon from './images/muted-microphone-icon.png'
import { PeerUserInfo } from '../../types/webrtc'

interface SocketMessage {
  userId: string
}

export const Room = () => {
  const { id: roomID } = useParams()
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState<boolean>(false)
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false)
  const [mutedUsers, setMutedUsers] = useState<string[]>([])

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

  // Уведомление о присоединении к комнате
  useEffect(() => {
    if (socket && currentUserId && roomID) {
      socket.emit('joinedToCall', {
        userId: currentUserId,
        roomID,
      })
    }
  }, [socket, roomID, currentUserId])

  // Обработка socket событий
  useEffect(() => {
    const handleMuted = (message: SocketMessage) => {
      setMutedUsers((prev) => [...prev, message.userId])
    }

    const handleUnmuted = (message: SocketMessage) => {
      setMutedUsers((prev) => prev.filter((id) => id !== message.userId))
    }

    socket?.on('muted', handleMuted)
    socket?.on('unmuted', handleUnmuted)

    return () => {
      socket?.off('muted', handleMuted)
      socket?.off('unmuted', handleUnmuted)
    }
  }, [socket])

  // Уведомление других пользователей о изменении состояния микрофона
  useEffect(() => {
    if (!socket || !currentUserId) return

    const notifyPeers = (event: 'muted' | 'unmuted') => {
      clients.forEach((clientID: string) => {
        if (clientID !== LOCAL_VIDEO) {
          // @ts-ignore
          const peerInfo = peerUserInfo[clientID]
          if (peerInfo?.userId) {
            socket.emit(event, {
              senderId: currentUserId,
              recipientId: peerInfo.userId,
            })
          }
        }
      })
    }

    if (isMicrophoneMuted) {
      setMutedUsers((prev) => [...prev, currentUserId])
      notifyPeers('muted')
    } else {
      setMutedUsers((prev) => prev.filter((id) => id !== currentUserId))
      notifyPeers('unmuted')
    }
  }, [isMicrophoneMuted, socket, currentUserId, clients, peerUserInfo])

  // Функция для получения userId по clientID
  const getUserIdByClientId = useCallback(
    (clientID: string): string | null => {
      if (clientID === LOCAL_VIDEO) {
        return currentUserId
      }
      // @ts-ignore
      return peerUserInfo[clientID]?.userId || null
    },
    [currentUserId, peerUserInfo]
  )

  // Функция для получения аватара по clientID
  const getAvatarByClientId = useCallback(
    (clientID: string): string | null => {
      if (clientID === LOCAL_VIDEO) {
        return currentUserAvatar
      }
      // @ts-ignore
      return peerUserInfo[clientID]?.avatar || null
    },
    [currentUserAvatar, peerUserInfo]
  )

  // Проверка, заглушен ли пользователь
  const isUserMuted = useCallback(
    (clientID: string): boolean => {
      const userId = getUserIdByClientId(clientID)
      return userId ? mutedUsers.includes(userId) : false
    },
    [mutedUsers, getUserIdByClientId]
  )

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
          value={thresholdDb}
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1vh' }}>
        {clients.map((clientID: string) => {
          const avatar = getAvatarByClientId(clientID)
          const muted = isUserMuted(clientID)

          return (
            <motion.div
              className={cl.userContainer}
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
                }}
              />
              <div className={cl.avatarContainer}>
                <AnimatePresence>
                  {isSpeaking && clientID === LOCAL_VIDEO && (
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
                {avatar && (
                  <img
                    src={avatar}
                    alt="avatar"
                    className={
                      isSpeaking && clientID === LOCAL_VIDEO
                        ? cl.avatarActive
                        : cl.avatar
                    }
                  />
                )}
              </div>

              <AnimatePresence>
                {muted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{
                      duration: 0.2,
                      ease: easeInOut,
                      delay: 0.2,
                      layout: {
                        duration: 0.3,
                        ease: easeInOut,
                      },
                    }}
                    className={cl.mutedMicrophoneContainer}
                  >
                    <img
                      className={cl.mutedMicrophoneIcon}
                      src={mutedMicrophoneIcon}
                      alt="muted-microphone"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
