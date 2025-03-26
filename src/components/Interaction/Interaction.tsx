import React from 'react'
import cl from './interaction.module.css'

interface Interaction {
  message: any
  setMessage: any
  sendMessage: any
}

export const Interaction: React.FC<Interaction> = ({
  message,
  setMessage,
  sendMessage,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }
  return (
    <div className={cl.container}>
      <textarea
        className={cl.input}
        placeholder="Написать в чат"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button className={cl.button} onClick={sendMessage}></button>
    </div>
  )
}
