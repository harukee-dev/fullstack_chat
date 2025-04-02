import React from 'react'
import cl from './myMessage.module.css'

interface IMessageProps {
  message: string
  username: string
}

export const MyMessage: React.FC<IMessageProps> = ({ message, username }) => {
  return (
    <div>
      <div className={cl.container}>
        <p className={cl.text}>{message}</p>
      </div>
    </div>
  )
}
