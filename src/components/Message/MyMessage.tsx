import React from 'react'
import cl from './myMessage.module.css'
import { motion } from 'framer-motion'

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
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className={cl.container}>
        <p className={cl.text}>{message}</p>
        <span className={cl.timestamp}>{time}</span>
      </div>
    </motion.div>
  )
}
