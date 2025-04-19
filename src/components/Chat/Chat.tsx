import React, { Fragment, useEffect, useRef, useState } from 'react'
import { Message } from '../Message/Message'
import { MyMessage } from '../Message/MyMessage'
import { IMessage } from '../../types/IMessage'
import { RefObject } from 'react'
import loading from './images/loading.gif'
import cl from './chat.module.css'
import { DateSeparator } from '../DateSeparator/DateSeparator'
import { format, isToday, isYesterday } from 'date-fns'
import { PinnedMessages } from '../PinnedMessages/PinnedMessages'

interface IChatProps {
  messages: IMessage[]
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
  const [pinnedMessages, setPinnedMessages] = useState<IMessage[]>([])
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!socket) return

    socket.on('messagePinned', (pinnedMessage: IMessage) => {
      setPinnedMessages((p) => [...p, pinnedMessage])
    })
  }, [socket, messages])

  useEffect(() => {
    const pinned = messages.filter((el) => el.isPinned)
    setPinnedMessages(pinned)
  }, [messages])

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

  useEffect(() => {
    const chatEl = chatRef.current
    if (chatEl) {
      chatEl.scrollTop = chatEl.scrollHeight
      handleScroll()
    }
  }, [messages])

  useEffect(() => {
    const chatEl = chatRef.current
    if (!chatEl) return

    chatEl.addEventListener('scroll', handleScroll)
    handleScroll()

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
      {pinnedMessages.length > 0 && (
        <PinnedMessages
          pinnedMessages={pinnedMessages}
          messageRefs={messageRefs.current}
        />
      )}

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

        // создаем ref если его ещё нет
        if (!messageRefs.current[el._id]) {
          messageRefs.current[el._id] = null
        }

        const setRef = (ref: HTMLDivElement | null) => {
          messageRefs.current[el._id] = ref
        }

        return (
          <Fragment key={el._id || index}>
            {shouldShowDate && (
              <DateSeparator date={formatDateLabel(currentMessageDate)} />
            )}
            {el.username === localStorage.getItem('username') ? (
              <MyMessage
                socket={socket}
                message={el}
                timestamp={el.timestamp || '01 Jan 1970 00:00:00 GMT'}
                setRef={setRef}
              />
            ) : (
              <Message
                socket={socket}
                message={el}
                timestamp={el.timestamp || '01 Jan 1970 00:00:00 GMT'}
                setRef={setRef}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
