import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { AppDispatch, RootState } from '../../store'
import { ChatComponent } from '../../components/Chat/Chat'
import { Interaction } from '../../components/Interaction/Interaction'
import cl from './ChatPage.module.css'
import { isTokenValid, sendMessage } from './ChatPageUtils'
import { API_URL, BOOSTY_URL } from '../../constants'
import { removeToken } from '../../slices/authSlice'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface IMessage {
  username: string
  text: string
}

export const Chat = () => {
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<IMessage[]>([])
  const token = useSelector((state: RootState) => state.auth.token)
  const isAuth = !!token
  const [socket, setSocket] = useState<Socket | null>(null)
  const [usersTyping, setUsersTyping] = useState<string[]>([])
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const username = localStorage.getItem('username')
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

  const handleLogout = () => {
    dispatch(removeToken())
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{ background: '#121212', height: '100vh' }}>
      <header className={cl.header}>
        <a className={cl.boosty} href={BOOSTY_URL}>
          <img
            className={cl.boostyImg}
            src={'https://kinamania.com/images/Boosty_logosvg.png'}
            alt="boosty"
          />
        </a>
        <button className={cl.loginOrLogoutButton} onClick={handleLogout}>
          {isTokenValid(token) ? 'Logout' : 'Login'}
        </button>
      </header>
      <div className={cl.chatPage}>
        <ChatComponent messages={messages} isClear={messages.length === 0} />
        <AnimatePresence>
          {/* {usersTyping.length > 0 && usersTyping.length < 3 && (
            <motion.p
              id="typing-indicator"
              className={cl.typingText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {usersTyping.join(', ')}{' '}
              {usersTyping.length === 1 ? 'is ' : 'are '}
              typing <span className={cl.dot}>.</span>
              <span className={cl.dot}>.</span>
              <span className={cl.dot}>.</span>
            </motion.p>
          )}
          {usersTyping.length >= 3 && (
            <motion.p
              id="typing-indicator"
              className={cl.typingText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {usersTyping[0]}, {usersTyping[1]} and others are typing{' '}
              <span className={cl.dot}>.</span>
              <span className={cl.dot}>.</span>
              <span className={cl.dot}>.</span>
            </motion.p>
          )} */}
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
        />
      </div>
    </div>
  )
}
