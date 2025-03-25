import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { AppDispatch, RootState } from '../../store'
import { useNavigate } from 'react-router-dom'
import { removeToken } from '../../slices/authSlice'
// @ts-ignore
import { jwtDecode } from 'jwt-decode'

interface IMessage {
  name: string
  message: string
}

export const Chat = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<IMessage[]>([])
  const token = useSelector((state: RootState) => state.auth.token)
  const navigate = useNavigate()
  const isAuth = !!token

  function isTokenValid() {
    if (!token) return false
    try {
      const decoded: any = jwtDecode(token)
      if (!decoded.exp) return false
      return decoded.exp * 1000 > Date.now()
    } catch (error) {
      return false
    }
  }

  const [socket, setSocket] = useState<Socket | null>(null)

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

      newSocket.on('message', (newMessage) => {
        setMessages((prevMessages) => [...prevMessages, newMessage])
      })

      return () => {
        newSocket.disconnect()
      }
    }
  }, [isAuth, token])

  function sendMessage() {
    if (message !== '' && socket) {
      socket.emit('message', { message: message })
      setMessage('')
    } else console.log('err: type something or socket not connected')
  }

  function handleLogout() {
    dispatch(removeToken())
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div>
      <div>
        <button onClick={handleLogout}>
          {isTokenValid() ? 'Выйти' : 'Войти'}
        </button>
      </div>
      <div>
        {messages.length > 0 ? (
          messages.map((el, index) => (
            <p key={index}>
              {el.name}:{el.message}
            </p>
          ))
        ) : (
          <p>no messages</p>
        )}
      </div>
      <input
        placeholder="Написать в чат"
        type="text"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') sendMessage()
        }}
      />
      <button onClick={sendMessage}>send</button>
    </div>
  )
}
