import { useEffect, useRef, useState } from 'react'
import { SystemNotification } from '../../components/SystemNotification/SystemNotification'
import { useAppSelector } from '../../store'
import { API_URL } from '../../constants'
import { io } from 'socket.io-client'
import ACTIONS from '../../backend/actions'
import { v4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../SocketContext'

export const TestPage = () => {
  const { token } = useAppSelector((state) => state.auth)
  const currentUserId = localStorage.getItem('user-id')
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [rooms, updateRooms] = useState([])
  const rootNode = useRef<any>(null)

  useEffect(() => {
    if (!socket) {
      console.log('!socket')
      return
    } else {
      console.log('socket')
    }
    socket.on(ACTIONS.SHARE_ROOMS, ({ rooms = [] } = {}) => {
      if (rootNode.current) {
        updateRooms(rooms)
      }
    })
  }, [socket])

  return (
    <div ref={rootNode}>
      <h1>Available Rooms</h1>

      <ul>
        {rooms.map((roomID) => (
          <li key={roomID}>
            {roomID}
            <button
              onClick={() => {
                navigate(`/test/room/${roomID}`)
              }}
            >
              JOIN ROOM
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => {
          navigate(`/test/room/${v4()}`)
        }}
      >
        Create New Room
      </button>
    </div>
  )
}
