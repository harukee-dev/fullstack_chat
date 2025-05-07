import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { RootState, useAppSelector } from '../../../store'
import { ChatComponent } from '../../../components/Chat/Chat'
import { Interaction } from '../../../components/Interaction/Interaction'
import cl from './rightWindow.module.css'
import { sendMessage } from '../ChatPageUtils'
import { API_URL } from '../../../constants'
import { AnimatePresence, motion } from 'framer-motion'
import { IMessage } from '../../../types/IMessage'

export const RightWindow = () => {
  const [message, setMessage] = useState<string>('')
  const [allMessages, setAllMessages] = useState<IMessage[]>([]) // ← оригинальный список
  const [messages, setMessages] = useState<IMessage[]>([])
  const token = useSelector((state: RootState) => state.auth.token)
  const isAuth = !!token
  const [socket, setSocket] = useState<Socket | null>(null)
  const [usersTyping, setUsersTyping] = useState<string[]>([])
  const username = localStorage.getItem('username')
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const replyMessage = useAppSelector((state) => state.reply.message)
  const searchValue = useAppSelector((state) => state.search.value)

  const fetchMessages = async () => {
    try {
      const response = await fetch(API_URL + '/auth/messages')
      const data = await response.json()

      setMessages(data)
      setAllMessages(data) // ← сохраняем полную копию
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error)
    }
  }

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
        console.log(newMessage._id)
      })

      newSocket.on('usersTyping', (usernames: string[]) => {
        setUsersTyping(usernames.filter((name) => name !== username)) // не отображай себя
      })

      newSocket.on('messageEdited', (updatedMessage: IMessage) => {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg._id === updatedMessage._id ? updatedMessage : msg
          )
        )
      })

      newSocket.on('messageDeleted', (deletedMessage) => {
        setMessages((prevMessages) =>
          prevMessages.filter((message) => message._id !== deletedMessage._id)
        )
      })

      return () => {
        newSocket.disconnect()
      }
    }
  }, [isAuth, token])

  // Загрузка сообщений из БД при открытии страницы
  useEffect(() => {
    fetchMessages()
  }, [])
  useEffect(() => {
    if (searchValue !== '') {
      const filtered = allMessages.filter((el) =>
        el.text.toLowerCase().includes(searchValue.toLowerCase())
      )

      if (filtered.length === 0) {
        console.log('Сообщения не найдены, отображаем все обратно')
        setMessages(allMessages)
      } else {
        setMessages(filtered)
      }
    } else {
      setMessages(allMessages)
    }
  }, [searchValue, allMessages])

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
        <div className={cl.chatHeader}>
          <div style={{ display: 'flex', gap: '.6vh' }}>
            <p className={cl.hashtag}>#</p>{' '}
            <p className={cl.chatName}>general chat</p>
          </div>
          <button className={cl.buttonOther}>···</button>
        </div>
        <ChatComponent
          socket={socket}
          chatRef={chatRef}
          setShowScrollButton={setShowScrollButton}
          messages={messages}
          isClear={messages.length === 0}
        />
        <AnimatePresence>
          {usersTyping.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              exit={{ opacity: 0 }}
              className={cl.typingDiv}
            >
              <span className={cl.typingText}>Someone is typing</span>
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
          sendMessage={() =>
            sendMessage(socket, message, setMessage, replyMessage)
          }
          scrollFunc={scrollToBottom}
        />
      </div>
    </div>
  )
}
