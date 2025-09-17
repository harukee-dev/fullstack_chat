// SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_URL } from './constants'
import { useAppSelector } from './store'

interface ISocketContext {
  socket: Socket | null
}

const SocketContext = createContext<ISocketContext>({ socket: null })

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token } = useAppSelector((state) => state.auth)
  const [socket, setSocket] = useState<Socket | null>(null)
  const currentUserId = localStorage.getItem('user-id')

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

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
