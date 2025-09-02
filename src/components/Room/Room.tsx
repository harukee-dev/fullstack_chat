import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC'
import { io } from 'socket.io-client'
import { API_URL } from '../../constants'
import { useAppSelector } from '../../store'

export const Room = () => {
  const { id: roomID } = useParams()
  const currentUserId = localStorage.getItem('user-id')
  const { token } = useAppSelector((state) => state.auth)

  const [socket, setSocket] = useState<any>(null)

  useEffect(() => {
    if (!token || !currentUserId) return

    const s = io(API_URL, {
      query: { userId: currentUserId },
      auth: { token },
      transports: ['websocket'],
    })

    setSocket(s)

    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [token, currentUserId])

  const { clients, provideMediaRef } = useWebRTC(roomID)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
      <h1>Room {roomID}</h1>
      {clients.map((clientID: string) => (
        <div key={clientID} style={{ flex: '1 1 40%' }}>
          <video
            ref={(instance) => provideMediaRef(clientID, instance)}
            autoPlay
            playsInline
            muted={clientID === LOCAL_VIDEO}
            style={{
              width: '30vw',
              borderRadius: '8px',
              backgroundColor: '#000',
            }}
          />
        </div>
      ))}
    </div>
  )
}
