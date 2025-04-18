import React, { useRef, useState } from 'react'
import cl from './interaction.module.css'
import { useDispatch } from 'react-redux'
import { AppDispatch, useAppSelector } from '../../store'
import { removeReplyMessage } from '../../slices/replyMessageSlice'
import closeIcon from './images/close_icon.png'

interface Interaction {
  message: any
  setMessage: any
  sendMessage: any
  socket: any
  scrollFunc: () => void
}

export const Interaction: React.FC<Interaction> = ({
  message,
  setMessage,
  sendMessage,
  socket,
  scrollFunc,
}) => {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const replyMessage = useAppSelector((state) => state.reply.message)
  const dispatch = useDispatch<AppDispatch>()

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
      dispatch(removeReplyMessage())
    }
  }

  const handleCancelReply = () => {
    dispatch(removeReplyMessage())
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
      {replyMessage !== null && (
        <div className={cl.reply}>
          <p className={cl.replyUsername}>{replyMessage?.username}</p>
          <p className={cl.replyText}>{replyMessage?.text}</p>
          <button onClick={handleCancelReply} className={cl.replyButton}>
            <img className={cl.closeIcon} src={closeIcon} alt="close-icon" />
          </button>
        </div>
      )}
      <textarea
        onClick={scrollFunc}
        className={cl.input}
        placeholder="Write something..."
        value={message}
        onChange={(event) => handleInputChange(event)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
