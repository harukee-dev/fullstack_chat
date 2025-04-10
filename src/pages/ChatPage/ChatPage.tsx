import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { RootState } from '../../store'
import { ChatComponent } from '../../components/Chat/Chat'
import { Interaction } from '../../components/Interaction/Interaction'
import cl from './ChatPage.module.css'
import { useLogout, isTokenValid, sendMessage } from './ChatPageUtils'
import { API_URL, BOOSTY_URL } from '../../constants'

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
        <button className={cl.loginOrLogoutButton} onClick={useLogout}>
          {isTokenValid(token) ? 'Logout' : 'Login'}
        </button>
      </header>
      <div className={cl.chatPage}>
        <ChatComponent messages={messages} isClear={messages.length === 0} />
        <Interaction
          message={message}
          setMessage={setMessage}
          sendMessage={() => sendMessage(socket, message, setMessage)}
        />
      </div>
    </div>
  )
}
