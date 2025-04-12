import React, { useRef, useState } from 'react'
import cl from './interaction.module.css'
import { useSelector } from 'react-redux'
import { useAppSelector } from '../../store'

interface Interaction {
  message: any
  setMessage: any
  sendMessage: any
  socket: any
}

export const Interaction: React.FC<Interaction> = ({
  message,
  setMessage,
  sendMessage,
  socket,
}) => {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isTyping, setIsTyping] = useState<boolean>(false)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const handleInputChange = (event: any) => {
    setMessage(event.target.value)

    if (!socket) return
    if (!isTyping) {
      setIsTyping(true)
      socket.emit('typing')
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping')
      setIsTyping(false)
    }, 2000)
  }
  return (
    <div className={cl.container}>
      <textarea
        className={cl.input}
        placeholder="Write something..."
        value={message}
        onChange={(event) => handleInputChange(event)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
