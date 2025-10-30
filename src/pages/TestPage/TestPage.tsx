// Импорты
import { useEffect, useState } from 'react'
import { v4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../SocketContext'
import cl from './testPage.module.css'
import { AnimatePresence, motion } from 'framer-motion'
import { ModalVoiceSettings } from '../../components/ModalVoiceSettings/ModalVoiceSettings'
import { CallInteraction } from '../../components/CallInteraction/CallInteraction'

// Компонент страницы теста
export const TestPage = () => {
  const { socket } = useSocket() // достаем сокет из контекста
  const navigate = useNavigate() // создаем функцию навигации
  const [rooms, updateRooms] = useState<any[]>([]) // state массив комнат
  const currentUsername = localStorage.getItem('username')
  const [hasRequested, setHasRequested] = useState(false)

  // Обработчик сокета
  useEffect(() => {
    if (!socket) {
      // проверка на валидность сокета
      return
    }

    socket.on('new-room', (room) => {
      // обработка сокет 'new-room'
      updateRooms((prev) => [...prev, room]) // добавляем новую комнату в state
    })

    socket.on('room-deleted', (roomId) => {
      updateRooms((prev) => prev.filter((el) => el.roomId !== roomId))
    })

    socket.on('receive-rooms', (receiveRooms) => {
      console.log('receive-rooms')
      updateRooms(receiveRooms)
    })

    return () => {
      socket.off('new-room')
      socket.off('receive-rooms')
    }
  }, [socket]) // а зависимости - сокет

  // Функция создания новой комнаты
  const handleCreateRoom = () => {
    const newRoomId = v4() // создаем рандомный айди для новой комнаты
    navigate(`/test/room/${newRoomId}`) // переносим пользователя на страницу новой комнаты
    socket?.emit('new-room', {
      roomId: newRoomId,
      roomName: `${currentUsername}'s room`,
    }) // уведомляем сервер о новой комнате
  }

  // Верстка компонента
  return (
    <div className={cl.testPage}>
      <div className={cl.titleAndButtonContainer}>
        <h1 className={cl.mainTitle}>ROOMS</h1>
        <button className={cl.buttonCreateRoom} onClick={handleCreateRoom}>
          +
        </button>
      </div>
      <p className={cl.subtitle}>Talk with your friends</p>
      <button
        className={cl.updateButton}
        onClick={() => socket?.emit('get-rooms')}
      >
        update
      </button>

      <div className={cl.roomsList}>
        <AnimatePresence>
          {rooms.map((room) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              exit={{ opacity: 0 }}
              className={cl.roomContainer}
              key={room.roomId}
            >
              <p className={cl.roomId}>{room.roomName}</p>
              <button
                className={cl.buttonJoin}
                onClick={() => {
                  navigate(`/test/room/${room.roomId}`)
                }}
              >
                join
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <ModalVoiceSettings />
        <CallInteraction />
      </div>
    </div>
  )
}
