import { useEffect, useState } from 'react'
import { v4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../SocketContext'
import cl from './testPage.module.css'

export const TestPage = () => {
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [rooms, updateRooms] = useState<any[]>([])

  useEffect(() => {
    if (!socket) {
      return
    }
    socket.on('new-room', (roomId) => {
      updateRooms([...rooms, roomId])
    })
  }, [socket])

  const handleCreateRoom = () => {
    const newRoomId = v4()
    navigate(`/test/room/${newRoomId}`)
    socket?.emit('new-room', newRoomId)
  }

  return (
    <div className={cl.testPage}>
      <h1 className={cl.mainTitle}>Test omnio calls</h1>

      <div className={cl.roomsList}>
        {rooms.map((roomID) => (
          <div className={cl.roomContainer} key={roomID}>
            <p className={cl.roomId}>{roomID}</p>
            <button
              className={cl.buttonJoin}
              onClick={() => {
                navigate(`/test/room/${roomID}`)
              }}
            >
              join
            </button>
          </div>
        ))}
      </div>

      <button className={cl.buttonCreateRoom} onClick={handleCreateRoom}>
        Create Room
      </button>
    </div>
  )
}
