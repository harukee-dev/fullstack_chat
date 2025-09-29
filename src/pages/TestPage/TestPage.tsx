import { useEffect, useRef, useState } from 'react'
import ACTIONS from '../../backend/actions'
import { v4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../SocketContext'
import cl from './testPage.module.css'

export const TestPage = () => {
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [rooms, updateRooms] = useState<any[]>([])
  const rootNode = useRef<any>(null)

  useEffect(() => {
    if (!socket) {
      console.log('!socket')
      return
    } else {
      console.log('socket')
    }
    // socket.on(ACTIONS.SHARE_ROOMS, ({ rooms = [] } = {}) => {
    //   if (rootNode.current) {
    //     updateRooms(rooms)
    //   }
    // })
    socket.on('new-room', (roomId) => {
      updateRooms([...rooms, roomId])
    })
  }, [socket])

  return (
    <div className={cl.testPage} ref={rootNode}>
      <h1 className={cl.mainTitle}>Available Rooms</h1>

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
              Join
            </button>
          </div>
        ))}
      </div>

      <button
        className={cl.buttonCreateRoom}
        onClick={() => {
          const newRoomId = v4()
          navigate(`/test/room/${newRoomId}`)
          socket?.emit('new-room', newRoomId)
        }}
      >
        Create New Room
      </button>
    </div>
  )
}
