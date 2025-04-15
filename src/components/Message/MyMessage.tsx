import React, { useState } from 'react'
import cl from './myMessage.module.css'
import { motion } from 'framer-motion'
import { IMessage } from '../../types/IMessage'
import { API_URL } from '../../constants'

interface IMessageProps {
  message: IMessage
  timestamp: Date | string
  socket: any
}

export const MyMessage: React.FC<IMessageProps> = ({
  message,
  timestamp,
  socket,
}) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [textareaValue, setTextareaValue] = useState<string>(message.text)

  const handleDoubleClick = () => {
    setIsEditing(true)
  }

  const handleBlur = async () => {
    setIsEditing(false)

    socket.emit('editMessage', {
      _id: message._id,
      text: textareaValue,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div onDoubleClick={handleDoubleClick} className={cl.container}>
        {!isEditing ? (
          <p className={cl.text}>{message.text}</p>
        ) : (
          <textarea
            className={cl.textarea}
            onBlur={handleBlur}
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
          ></textarea>
        )}
        <span className={cl.timestamp}>{time}</span>
      </div>
    </motion.div>
  )
}
