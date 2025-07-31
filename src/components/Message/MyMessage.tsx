import React, { useEffect, useState } from 'react'
import cl from './myMessage.module.css'
import { AnimatePresence, motion } from 'framer-motion'
import { IMessage } from '../../types/IMessage'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setReplyMessage } from '../../slices/replyMessageSlice'
import { MessageInteraction } from '../MessageInteraction/MessageInteraction'
import replyIcon from './images/reply-render.svg'

interface IMessageProps {
  message: IMessage
  timestamp: Date | string
  socket: any
  setRef?: (ref: HTMLDivElement | null) => void
}

export const MyMessage: React.FC<IMessageProps> = ({
  message,
  timestamp,
  socket,
  setRef,
}) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const [isInteraction, setIsInteraction] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [textareaValue, setTextareaValue] = useState<string>(message.text)
  const dispatch = useDispatch<AppDispatch>()
  const [isPinned, setIsPinned] = useState(message.isPinned || false)
  const [cache, setCache] = useState<string>('')

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
      }
    })
  }, [socket])

  const handlePin = () => {
    if (message && !isPinned) {
      socket.emit('newPin', { _id: message._id, chatId: message.chatId })
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

  const handleDelete = () => {
    socket.emit('deleteMessage', { _id: message._id })
    console.log('request to delete, _id: ' + message._id)
  }

  // WORK HERE

  const handleMouseEnter = () => {
    setIsInteraction(() => true)
    setCache(textareaValue)
  }

  const handleMouseLeave = () => {
    setIsInteraction(() => false)
  }

  const handleBlur = async () => {
    setIsEditing(false)

    if (
      /[a-zA-Zа-яА-Я0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(textareaValue)
    ) {
      socket.emit('editMessage', {
        _id: message._id,
        text: textareaValue,
      })
    } else {
      setTextareaValue(cache)
    }
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
      <motion.div
        style={{ width: '100%' }}
        // initial={{ x: 10 }}
        // animate={{ x: 0 }}
        // transition={{ duration: 0.4 }}
      >
        <div className={cl.container}>
          {message.replyMessage ? (
            <div
              style={{ display: 'flex', gap: '.35vw', alignItems: 'center' }}
            >
              <div className={cl.reply}>
                <p className={cl.replyText}>{message.replyMessage.text}</p>
                <img draggable={false} src={replyIcon} alt="reply-icon" />
              </div>
              <p className={cl.username}>
                ({time}) {message.senderId.username}
              </p>
            </div>
          ) : (
            <p className={cl.username}>
              ({time}) {message.senderId.username}
            </p>
          )}
          {!isEditing ? (
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
          ) : (
            <textarea
              maxLength={1000}
              className={cl.textarea}
              onBlur={handleBlur}
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault() // Предотвращаем перевод строки
                  e.currentTarget.blur() // Триггерим blur → отправка
                }
              }}
            ></textarea>
          )}
          <AnimatePresence>
            {isInteraction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cl.interactionContainer}
              >
                <MessageInteraction
                  isPinned={isPinned}
                  editFunc={() => setIsEditing(true)}
                  deleteFunc={handleDelete}
                  pinFunc={handlePin}
                  replyFunc={handleReply}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <img
        draggable={false}
        className={cl.userIcon}
        // EDIT HERE
        // src={defaultUserIcon}
        src={message.senderId.avatar}
        alt="default-user-icon"
      />
    </motion.div>
  )
}
