import { useEffect, useRef } from 'react'
import { Message } from '../Message/Message'
import cl from './chat.module.css'
import { MyMessage } from '../Message/MyMessage'
import { IMessage } from '../../types/IMessage'
import { RefObject } from 'react'
// @ts-ignore
import loading from './images/loading.gif'
import React from 'react'
import { DateSeparator } from '../DateSeparator/DateSeparator'
import { format } from 'date-fns'

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
        const prevMessage = index > 0 ? messages[index - 1] : null
        const currentDate = format(
          new Date(el.timestamp ?? new Date()),
          'MMMM d'
        )
        const prevDate = prevMessage
          ? format(new Date(prevMessage.timestamp ?? new Date()), 'MMMM d')
          : null

        const shouldShowDateSeparator = currentDate !== prevDate

        return (
          <React.Fragment key={el._id || index}>
            {shouldShowDateSeparator && <DateSeparator date={currentDate} />}
            {el.username === localStorage.getItem('username') ? (
              <MyMessage
                socket={socket}
                message={el}
                timestamp={el.timestamp || '"01 Jan 1970 00:00:00 GMT"'}
              />
            ) : (
              <Message
                message={el.text}
                username={el.username}
                timestamp={el.timestamp || '"01 Jan 1970 00:00:00 GMT"'}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
