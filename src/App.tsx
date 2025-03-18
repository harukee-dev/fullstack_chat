import React, { useEffect, useState } from 'react'
import io from 'socket.io-client'

const socket = io('http://localhost:10000')

function App() {
  const [message, setMessage] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    socket.on('message', (newMessage) => {
      console.log('Received message:', newMessage)
      setMessages((prevMessages) => [...prevMessages, newMessage])
    })

    return () => {
      socket.off('message')
    }
  }, [])

  function sendMessage() {
    if (message !== '' && username !== '') {
      socket.emit('message', { name: username, message: message })
      setMessage('')
    } else console.log('err: type something')
  }

  return (
    <div>
      <h1>harugram</h1>
      <input
        placeholder="Написать в чат"
        type="text"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') sendMessage()
        }}
      />
      <input
        type="text"
        placeholder="Никнейм"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
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

export default App
