import React from 'react'
import cl from './message.module.css'

interface IMessageProps {
  message: string
  username: string
  timestamp: Date | string
}

export const Message: React.FC<IMessageProps> = ({
  message,
  username,
  timestamp,
}) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div>
      <p className={cl.username}>{username}</p>
      <div className={cl.container}>
        <p className={cl.text}>{message}</p>
        <span className={cl.timestamp}>{time}</span>
      </div>
    </div>
  )
}
