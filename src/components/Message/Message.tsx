import React from 'react'
import cl from './message.module.css'

interface IMessageProps {
  message: string
  username: string
}

export const Message: React.FC<IMessageProps> = ({ message, username }) => {
  return (
    <>
      <div className={cl.container}>
        <p className={cl.text}>{message}</p>
      </div>
      <p className={cl.username}>{username}</p>
    </>
  )
}
