import React from 'react'
import cl from './message.module.css'
import { motion } from 'framer-motion'
import { useSwipeable } from 'react-swipeable'
import { IMessage } from '../../types/IMessage'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setReplyMessage } from '../../slices/replyMessageSlice'

interface IMessageProps {
  message: IMessage
  timestamp: Date | string
  setRef?: (ref: HTMLDivElement | null) => void
  socket: any
}

export const Message: React.FC<IMessageProps> = ({
  message,
  timestamp,
  setRef,
  socket,
}) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const dispatch = useDispatch<AppDispatch>()

  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (message) {
        dispatch(setReplyMessage(message))
        console.log(localStorage.getItem('replyMessage'))
      }
    },
    onSwipedUp: () => {
      if (message) {
        socket.emit('newPin', { _id: message._id })
      }
    },
    delta: 50,
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: true,
  })

  return (
    <div ref={setRef}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        {...handlers}
      >
        <p className={cl.username}>{message.username}</p>
        <div className={cl.container}>
          {message.replyMessage && (
            <div className={cl.reply}>
              <p className={cl.replyUsername}>
                {message.replyMessage.username}
              </p>
              <p className={cl.replyText}>{message.replyMessage.text}</p>
            </div>
          )}
          <p className={cl.text}>{message.text}</p>
          <span className={cl.timestamp}>{time}</span>
        </div>
      </motion.div>
    </div>
  )
}
