import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { AppDispatch, RootState } from '../../../store'
import { ChatComponent } from '../../../components/Chat/Chat'
import { Interaction } from '../../../components/Interaction/Interaction'
import cl from './rightWindow.module.css'
import { sendMessage } from '../ChatPageUtils'
import { API_URL } from '../../../constants'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { OnlineUsersList } from '../../../components/OnlineUsersList/OnlineUsersList'

interface IMessage {
  username: string
  text: string
}

export const RightWindow = () => {
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<IMessage[]>([])
  const token = useSelector((state: RootState) => state.auth.token)
  const isAuth = !!token
  const [socket, setSocket] = useState<Socket | null>(null)
  const [usersTyping, setUsersTyping] = useState<string[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const username = localStorage.getItem('username')
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false)
  const chatRef = useRef<HTMLDivElement>(null)
  // Подключение к серверу
  useEffect(() => {
    if (isAuth) {
      const newSocket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
      })

      newSocket.on('connect_error', (error) => {
        console.log('Ошибка подключения:', error)
      })

      setSocket(newSocket)

      newSocket.on('message', (newMessage: IMessage) => {
        setMessages((prevMessages) => [...prevMessages, newMessage])
      })

      newSocket.on('usersTyping', (usernames: string[]) => {
        setUsersTyping(usernames.filter((name) => name !== username)) // не отображай себя
      })

      newSocket.on('onlineUsers', (onlineUsers: string[]) => {
        setOnlineUsers(onlineUsers)
      })

      return () => {
        newSocket.disconnect()
      }
    }
  }, [isAuth, token])

  // Загрузка сообщений из БД при открытии страницы
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(API_URL + '/auth/messages')
        const data = await response.json()
        setMessages(data)
      } catch (error) {
        console.error('Ошибка загрузки сообщений:', error)
      }
    }

    fetchMessages()
  }, [])

  const [onlineListIsOpened, setOnlineListIsOpened] = useState<boolean>(false)
  const handleOnlineButton = () => {
    setOnlineListIsOpened(!onlineListIsOpened)
  }

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth', // ключевая часть!
      })
    }
  }

  return (
    <div style={{ background: '#121212', height: '100vh' }}>
      <div className={cl.chatPage}>
        {/* ONLINE BUTTON */}
        <button onClick={handleOnlineButton} className={cl.onlineListButton}>
          <div className={cl.onlineCircle} />
          {onlineUsers.length}
        </button>
        <OnlineUsersList isOpened={onlineListIsOpened} users={onlineUsers} />
        <ChatComponent
          chatRef={chatRef}
          setShowScrollButton={setShowScrollButton}
          messages={messages}
          isClear={messages.length === 0}
        />
        <AnimatePresence>
          {usersTyping.length > 0 && (
            <motion.div
              id="typing-indicator"
              className={cl.typingDiv}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <span className={cl.dot}>.</span>
              <span className={cl.dot}>.</span>
              <span className={cl.dot}>.</span>
            </motion.div>
          )}
        </AnimatePresence>
        <Interaction
          socket={socket}
          message={message}
          setMessage={setMessage}
          sendMessage={() => sendMessage(socket, message, setMessage)}
          scrollFunc={scrollToBottom}
        />
      </div>
    </div>
  )
}
