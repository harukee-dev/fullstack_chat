import React, { useEffect, useRef, useState } from 'react'
import cl from './interaction.module.css'
import { useDispatch } from 'react-redux'
import { AppDispatch, useAppSelector } from '../../store'
import { removeReplyMessage } from '../../slices/replyMessageSlice'
import closeIcon from './images/close_icon.png'
import { EmojiPicker } from '../EmojiPicker/EmojiPicker'
import sendIcon from './images/send-icon.svg'

interface Interaction {
  message: any
  setMessage: any
  sendMessage: any
  socket: any
}

export const Interaction: React.FC<Interaction> = ({
  message,
  setMessage,
  sendMessage,
  socket,
}) => {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const replyMessage = useAppSelector((state) => state.reply.message)
  const dispatch = useDispatch<AppDispatch>()
  const [isEmojiOpened, setIsEmojiOpened] = useState<boolean>(false)

  useEffect(() => {
    if (!socket) return
    socket.on('message', () => {
      if (!!typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      setIsTyping(false)
    })
  }, [socket])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
      dispatch(removeReplyMessage())
    }
  }

  const handleCancelReply = () => {
    dispatch(removeReplyMessage())
  }

  const handleInputChange = (event: any) => {
    setMessage(event.target.value)

    if (!socket) return
    if (!isTyping) {
      setIsTyping(true)
      socket.emit('typing')
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping')
      setIsTyping(false)
    }, 2000)
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev: string) => prev + emoji)
  }

  const handleEmojiOpen = () => {
    setIsEmojiOpened((prev) => !prev)
  }

  return (
    <div
      className={
        replyMessage !== null ? cl.allInteraction : cl.allInteractionWithout
      }
    >
      {replyMessage !== null && (
        <div onClick={handleCancelReply} className={cl.reply}>
          <div>
            <p className={cl.replyUsername}>
              Reply to{' '}
              <span className={cl.replyMessageUsername}>
                {replyMessage?.senderId.username}
              </span>
            </p>
            <p className={cl.replyText}>{replyMessage?.text}</p>
          </div>
        </div>
      )}
      <div className={cl.container}>
        <EmojiPicker onSelect={handleEmojiSelect} isVisible={isEmojiOpened} />
        <textarea
          className={cl.input}
          placeholder="Write something..."
          value={message}
          onChange={(event) => handleInputChange(event)}
          onKeyDown={handleKeyDown}
        />
        <img
          onClick={sendMessage}
          draggable={false}
          className={cl.sendButton}
          src={sendIcon}
          alt="send"
        />
      </div>
    </div>
  )
}
