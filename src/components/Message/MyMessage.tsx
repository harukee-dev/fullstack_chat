import React, { useEffect, useState } from 'react'
import cl from './myMessage.module.css'
import { AnimatePresence, motion } from 'framer-motion'
import { IMessage } from '../../types/IMessage'
import { API_URL } from '../../constants'
import { useSwipeable } from 'react-swipeable'
import { useDispatch } from 'react-redux'
import { AppDispatch, useAppSelector } from '../../store'
import { setReplyMessage } from '../../slices/replyMessageSlice'
import { MessageInteraction } from '../MessageInteraction/MessageInteraction'

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

  // const handlers = useSwipeable({
  //   onSwipedLeft: () => {
  //     if (message) {
  //       dispatch(setReplyMessage(message))
  //       console.log(localStorage.getItem('replyMessage'))
  //     }
  //   },
  //   onSwipedUp: () => {
  //     if (message) {
  //       socket.emit('newPin', { _id: message._id })
  //     }
  //   },
  //   delta: 50, // минимальное расстояние для триггера свайпа
  //   preventScrollOnSwipe: true,
  //   trackTouch: true,
  //   trackMouse: true,
  // })

  const handlePin = () => {
    if (message) {
      socket.emit('newPin', { _id: message._id })
    }
  }

  const handleReply = () => {
    if (message) {
      dispatch(setReplyMessage(message))
      console.log(localStorage.getItem('replyMessage'))
    }
  }

  const handleDelete = () => {
    socket.emit('deleteMessage', { _id: message._id })
    console.log('request to delete, _id: ' + message._id)
  }

  const handleClick = () => {
    setIsInteraction((interaction) => !interaction)
    console.log(isInteraction)
  }

  const handleBlur = async () => {
    setIsEditing(false)

    socket.emit('editMessage', {
      _id: message._id,
      text: textareaValue,
    })
  }

  return (
    <div ref={setRef}>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div onClick={handleClick} className={cl.container}>
          <AnimatePresence>
            {isInteraction && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} // добавляем анимацию выхода
                transition={{ duration: 0.2 }}
                className={cl.interactionContainer}
              >
                <MessageInteraction
                  editFunc={() => setIsEditing(true)}
                  deleteFunc={handleDelete}
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
          {!isEditing ? (
            <p className={cl.text}>{message.text}</p>
          ) : (
            <textarea
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
          <span className={cl.timestamp}>{time}</span>
        </div>
      </motion.div>
    </div>
  )
}
