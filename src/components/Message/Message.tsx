import React, { useEffect, useState } from 'react'
import cl from './message.module.css'
import { motion, AnimatePresence } from 'framer-motion'
import { IMessage } from '../../types/IMessage'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setReplyMessage } from '../../slices/replyMessageSlice'
import { MessageInteraction } from '../MessageInteraction/MessageInteraction'

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
  const [isInteraction, setIsInteraction] = useState<boolean>(false)
  const [isPinned, setIsPinned] = useState(message.isPinned || false)

  useEffect(() => {
    socket.on('messagePinned', (pinmsg: IMessage) => {
      if (pinmsg._id === message._id) {
        setIsPinned(true)
      }
    })
    socket.on('messageUnpinned', (unpinnedMessage: IMessage) => {
      if (unpinnedMessage._id === message._id) {
        setIsPinned(false)
      }
    })
    socket.on('openedInteraction', (id: string) => {
      if (id !== message._id) {
        setIsInteraction(false)
        console.log(id)
        console.log(message._id)
      }
    })
  }, [socket])

  const handlePin = () => {
    if (message && !isPinned) {
      socket.emit('newPin', { _id: message._id })
    }
    if (message && isPinned) {
      socket.emit('unpin', { _id: message._id })
    }
  }

  const handleReply = () => {
    if (message) {
      dispatch(setReplyMessage(message))
    }
  }

  const handleClick = () => {
    setIsInteraction((interaction) => !interaction)
    socket.emit('closeInteractions', { _id: message._id })
  }

  return (
    <div ref={setRef}>
      <motion.div
        initial={{ x: -10 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className={cl.username}>{message.username}</p>
        <div onClick={handleClick} className={cl.container}>
          <AnimatePresence>
            {isInteraction && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className={cl.interactionContainer}
              >
                <MessageInteraction
                  isPinned={isPinned}
                  editFunc={null}
                  deleteFunc={null}
                  pinFunc={handlePin}
                  replyFunc={handleReply}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {message.replyMessage && (
            <div className={cl.reply}>
              <p className={cl.replyUsername}>
                {message.replyMessage.username}
              </p>
              <p className={cl.replyText}>{message.replyMessage.text}</p>
            </div>
          )}
          <p onBlur={() => setIsInteraction(false)} className={cl.text}>
            {message.text}
          </p>
          <span className={cl.timestamp}>{time}</span>
        </div>
      </motion.div>
    </div>
  )
}
