import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { RootState } from '../../store'

export const Chat = () => {
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<string[]>([])
  const token = useSelector((state: RootState) => state.auth.token)
  const isAuth = !!token

  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (isAuth) {
      console.log('Пользователь авторизован', token)

      const newSocket = io('http://localhost:10000', {
        auth: { token },
        transports: ['websocket'],
      })

      newSocket.on('connect', () => {
        console.log('Подключение установлено')
      })

      newSocket.on('connect_error', (error) => {
        console.log('Ошибка подключения:', error)
      })

      setSocket(newSocket)

      newSocket.on('message', (newMessage) => {
        console.log('Получено сообщение:', newMessage)
        setMessages((prevMessages) => [...prevMessages, newMessage])
      })

      return () => {
        newSocket.disconnect()
      }
    } else {
      console.log('Пользователь не авторизован')
    }
  }, [isAuth, token])

  function sendMessage() {
    if (message !== '' && socket) {
      socket.emit('message', { message: message })
      setMessage('')
    } else console.log('err: type something or socket not connected')
  }

  return (
    <div>
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
      <div>
        {messages.length > 0 ? (
          messages.map((el, index) => <p key={index}>{el}</p>)
        ) : (
          <p>no messages</p>
        )}
      </div>
    </div>
  )
}
