import { Fragment, useEffect, useRef } from 'react'
import { Message } from '../Message/Message'
import cl from './chat.module.css'
import { MyMessage } from '../Message/MyMessage'
import { IMessage } from '../../types/IMessage'
import { RefObject } from 'react'
// @ts-ignore
import loading from './images/loading.gif'
import React from 'react'
import { DateSeparator } from '../DateSeparator/DateSeparator'
import { format, isToday, isYesterday } from 'date-fns'

interface IChatProps {
  messages: IMessage[] | []
  isClear: boolean
  setShowScrollButton: (value: boolean) => void
  chatRef: RefObject<HTMLDivElement | null>
  socket: any
}

export const ChatComponent: React.FC<IChatProps> = ({
  messages,
  isClear,
  setShowScrollButton,
  chatRef,
  socket,
}) => {
  const handleScroll = () => {
    const chatEl = chatRef.current
    if (!chatEl) return

    const isScrolledUp =
      chatEl.scrollTop + chatEl.clientHeight < chatEl.scrollHeight - 10

    setShowScrollButton(isScrolledUp)
  }

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMMM d')
  }

  // Скролл вниз при новом сообщении
  useEffect(() => {
    const chatEl = chatRef.current
    if (chatEl) {
      chatEl.scrollTop = chatEl.scrollHeight
      handleScroll() // Проверка скролла после прокрутки
    }
  }, [messages])

  // Навешиваем обработчик скролла
  useEffect(() => {
    const chatEl = chatRef.current
    if (!chatEl) return

    chatEl.addEventListener('scroll', handleScroll)
    handleScroll() // Проверка при инициализации

    return () => {
      chatEl.removeEventListener('scroll', handleScroll)
    }
  }, [chatRef])

  if (isClear) {
    return (
      <div className={cl.chat}>
        <div className={cl.clearContainer}>
          <img src={loading} className={cl.isClear} />
        </div>
      </div>
    )
  }

  return (
    <div className={cl.chat} ref={chatRef}>
      {messages.map((el, index) => {
        const currentMessageDate = new Date(el.timestamp ?? new Date())
        const prevMessage = messages[index - 1]
        const prevMessageDate = prevMessage
          ? new Date(prevMessage.timestamp ?? new Date())
          : null

        const shouldShowDate =
          !prevMessageDate ||
          format(currentMessageDate, 'yyyy-MM-dd') !==
            format(prevMessageDate, 'yyyy-MM-dd')

        return (
          <Fragment key={index}>
            {shouldShowDate && (
              <DateSeparator date={formatDateLabel(currentMessageDate)} />
            )}
            {el.username === localStorage.getItem('username') ? (
              <MyMessage
                socket={socket}
                message={el}
                timestamp={el.timestamp || '01 Jan 1970 00:00:00 GMT'}
              />
            ) : (
              <Message
                message={el.text}
                username={el.username}
                timestamp={el.timestamp || '01 Jan 1970 00:00:00 GMT'}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
