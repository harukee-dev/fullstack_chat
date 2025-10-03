// Импорты
import { useEffect, useState } from 'react'
import { v4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../SocketContext'
import cl from './testPage.module.css'

// Компонент страницы теста
export const TestPage = () => {
  const { socket } = useSocket() // достаем сокет из контекста
  const navigate = useNavigate() // создаем функцию навигации
  const [rooms, updateRooms] = useState<any[]>([]) // state массив комнат

  // Обработчик сокета
  useEffect(() => {
    if (!socket) {
      // проверка на валидность сокета
      return
    }
    socket.on('new-room', (roomId) => {
      // обработка сокет 'new-room'
      updateRooms([...rooms, roomId]) // добавляем новую комнату в state
    })
  }, [socket]) // а зависимости - сокет

  // Функция создания новой комнаты
  const handleCreateRoom = () => {
    const newRoomId = v4() // создаем рандомный айди для новой комнаты
    navigate(`/test/room/${newRoomId}`) // переносим пользователя на страницу новой комнаты
    socket?.emit('new-room', newRoomId) // уведомляем сервер о новой комнате
  }

  // Верстка компонента
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
