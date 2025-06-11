import React, { useEffect, useState } from 'react'
import cl from './message.module.css'
import { motion, AnimatePresence } from 'framer-motion'
import { IMessage } from '../../types/IMessage'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setReplyMessage } from '../../slices/replyMessageSlice'
import replyIcon from './images/reply-other-message.svg'
import replyIconMessage from './images/reply-render.svg'

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cl.allMessage}
      ref={setRef}
    >
      <img
        draggable={false}
        className={cl.userIcon}
        // EDIT HERE
        // src={defaultUserIcon}
        src={message.senderId.avatar}
        alt="default-user-icon"
      />
      <motion.div
      // initial={{ x: -10 }}
      // animate={{ x: 0 }}
      // transition={{ duration: 0.4 }}
      >
        <div className={cl.container}>
          <AnimatePresence>
            {message.replyMessage ? (
              <div
                style={{ display: 'flex', gap: '.35vw', alignItems: 'center' }}
              >
                <p className={cl.username}>
                  ({time}) {message.senderId.username}
                </p>
                <div className={cl.reply}>
                  <p className={cl.replyText}>{message.replyMessage.text}</p>
                  <img
                    draggable={false}
                    src={replyIconMessage}
                    alt="reply-icon"
                  />
                </div>
              </div>
            ) : (
              <p className={cl.username}>
                ({time}) {message.senderId.username}
              </p>
            )}
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
                    draggable={false}
                    className={cl.replyButtonIcon}
                    src={replyIcon}
                    alt="reply-icon"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p
            className={
              (message.text.startsWith('/rainbow ') && cl.rainbowText) ||
              cl.text
            }
          >
            {(message.text.startsWith('/rainbow ') &&
              message.text.substring(9)) ||
              message.text}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
