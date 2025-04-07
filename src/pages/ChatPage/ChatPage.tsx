import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { AppDispatch, RootState } from '../../store'
import { useNavigate } from 'react-router-dom'
import { removeToken } from '../../slices/authSlice'
// @ts-ignore
import { jwtDecode } from 'jwt-decode'
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
      const newSocket = io('https://fullstack-chat-6mbf.onrender.com', {
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
        const response = await fetch(
          'https://fullstack-chat-6mbf.onrender.com/auth/messages'
        )
        const data = await response.json()
        setMessages(data)
      } catch (error) {
        console.error('Ошибка загрузки сообщений:', error)
      }
    }

    fetchMessages()
  }, [])

  function sendMessage() {
    if (!socket || message.trim() === '') {
      console.log('Ошибка: сообщение пустое или сокет не подключен')
      return
    } // проверяем что сокет подключен и сообщение не пустое

    const maxLength = 1000 // задаем максимальную длину сообщения

    // Разделяем сообщение на слова - убираем лишние пробелы в начале и в конце, делаем из строки массив слов
    const words = message.trim().split(' ')
    let buffer = '' // создаем переменную в которую будем класть слова пока длина не станет больше 1000

    for (let i = 0; i < words.length; i++) {
      // создаем цикл который будет проходиться по массиву слов
      const word = words[i] // задаем слово

      // Проверяем, влезает ли слово в буфер
      if ((buffer + ' ' + word).trim().length <= maxLength) {
        buffer = (buffer + ' ' + word).trim() // если влезает, то добавляем в буфер еще одно слово
      } else {
        if (buffer.length > 0) {
          socket.emit('message', { text: buffer }) // если не влезает и буфер не пустой то отправляем наш заполненный буфер как сообщение
        }
        buffer = word // начинаем новую часть
      }
    }

    // Отправляем оставшийся буфер
    if (buffer.length > 0) {
      socket.emit('message', { text: buffer })
    }
    setMessage('')
  }

  function handleLogout() {
    dispatch(removeToken())
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{ background: '#121212', height: '100vh' }}>
      <header className={cl.header}>
        <button className={cl.loginOrLogoutButton} onClick={handleLogout}>
          {isTokenValid() ? 'Logout' : 'Login'}
        </button>
      </header>
      <div
        style={{
          overflow: 'hidden',
          backgroundColor: '#121212',
          padding: '0 10px 10px 10px',
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
