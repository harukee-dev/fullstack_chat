import React from 'react'
import cl from './myMessage.module.css'

interface IMessageProps {
  message: string
  timestamp: Date | string
}

export const MyMessage: React.FC<IMessageProps> = ({ message, timestamp }) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div>
      <div className={cl.container}>
        <p className={cl.text}>{message}</p>
        <span className={cl.timestamp}>{time}</span>
      </div>
    </div>
  )
}
