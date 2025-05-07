import React, { useEffect, useState } from 'react'
import cl from './message.module.css'
import { motion, AnimatePresence } from 'framer-motion'
import { IMessage } from '../../types/IMessage'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setReplyMessage } from '../../slices/replyMessageSlice'
import defaultUserIcon from './images/user-default-icon.png'
import replyIcon from './images/reply-other-message.svg'

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

  const handleMouseEnter = () => {
    setIsInteraction(() => true)
  }

  const handleMouseLeave = () => {
    setIsInteraction(() => false)
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cl.allMessage}
      ref={setRef}
    >
      <img
        className={cl.userIcon}
        src={defaultUserIcon}
        alt="default-user-icon"
      />
      <motion.div
      // initial={{ x: -10 }}
      // animate={{ x: 0 }}
      // transition={{ duration: 0.4 }}
      >
        <div className={cl.container}>
          <AnimatePresence>
            <p className={cl.username}>
              {message.username} ({time})
            </p>
            {isInteraction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cl.interactionContainer}
              >
                <div onClick={handleReply} className={cl.replyButton}>
                  <p className={cl.replyButtonText}>Reply message</p>
                  <img
                    className={cl.replyButtonIcon}
                    src={replyIcon}
                    alt="reply-icon"
                  />
                </div>
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
        </div>
      </motion.div>
    </div>
  )
}
