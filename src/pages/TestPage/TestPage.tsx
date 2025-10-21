// Импорты
import { useEffect, useState } from 'react'
import { v4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../SocketContext'
import cl from './testPage.module.css'
import { AnimatePresence, motion } from 'framer-motion'
import { ModalVoiceSettings } from '../../components/ModalVoiceSettings/ModalVoiceSettings'

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
      <div className={cl.titleAndButtonContainer}>
        <h1 className={cl.mainTitle}>ROOMS</h1>
        <button className={cl.buttonCreateRoom} onClick={handleCreateRoom}>
          +
        </button>
      </div>
      <p className={cl.subtitle}>Talk with your friends</p>

      <div className={cl.roomsList}>
        <AnimatePresence>
          {rooms.map((roomID) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              exit={{ opacity: 0 }}
              className={cl.roomContainer}
              key={roomID}
            >
              <p className={cl.roomId}>{roomID}</p>
              <button
                className={cl.buttonJoin}
                onClick={() => {
                  navigate(`/test/room/${roomID}`)
                }}
              >
                join
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <ModalVoiceSettings />
      </div>
    </div>
  )
}
