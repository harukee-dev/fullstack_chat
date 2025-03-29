import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { AppDispatch, RootState } from '../../store'
import { useNavigate } from 'react-router-dom'
import { removeToken } from '../../slices/authSlice'
// @ts-ignore
import { jwtDecode } from 'jwt-decode'
import { Message } from '../../components/Message/Message'
import { ChatComponent } from '../../components/Chat/Chat'
import { Interaction } from '../../components/Interaction/Interaction'
import cl from './ChatPage.module.css'

interface IMessage {
  username: string
  text: string
}

export const Chat = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<IMessage[]>([])
  const token = useSelector((state: RootState) => state.auth.token)
  const navigate = useNavigate()
  const isAuth = !!token
  const [socket, setSocket] = useState<Socket | null>(null)

  function isTokenValid() {
    if (!token) return false
    try {
      const decoded: any = jwtDecode(token)
      return decoded.exp * 1000 > Date.now()
    } catch {
      return false
    }
  }

  // Подключение к серверу
  useEffect(() => {
    if (isAuth) {
      const newSocket = io('http://localhost:10000', {
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

      console.log(messages)

      return () => {
        newSocket.disconnect()
      }
    }
  }, [isAuth, token])

  // Загрузка сообщений из БД при открытии страницы
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('http://localhost:10000/auth/messages')
        const data = await response.json()
        setMessages(data)
      } catch (error) {
        console.error('Ошибка загрузки сообщений:', error)
      }
    }

    fetchMessages()
  }, [])

  function sendMessage() {
    if (message.trim() !== '' && socket && message.length < 10) {
      const newMessage = { text: message }
      socket.emit('message', newMessage)
      setMessage('')
    } else {
      console.log('Ошибка: сообщение пустое или сокет не подключен')
    }
  }

  function handleLogout() {
    dispatch(removeToken())
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{ background: '#121212', height: '100vh' }}>
      <button className={cl.loginOrLogoutButton} onClick={handleLogout}>
        {isTokenValid() ? 'Logout' : 'Login'}
      </button>
      <div
        style={{
          overflow: 'hidden',
          backgroundColor: '#121212',
          padding: '10px',
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <ChatComponent messages={messages} isClear={messages.length === 0} />
        <Interaction
          message={message}
          setMessage={setMessage}
          sendMessage={sendMessage}
        />
      </div>
    </div>
  )
}
