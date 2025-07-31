import React, { Fragment, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Message } from '../Message/Message'
import { MyMessage } from '../Message/MyMessage'
import { IMessage } from '../../types/IMessage'
import { RefObject } from 'react'
import loading from './images/loading.gif'
import cl from './chat.module.css'
import { DateSeparator } from '../DateSeparator/DateSeparator'
import { format, isToday, isYesterday } from 'date-fns'
import { API_URL } from '../../constants'

interface IChatComponentProps {
  setShowScrollButton: (value: boolean) => void
  chatRef: RefObject<HTMLDivElement | null>
  socket: any
}

export const ChatComponent: React.FC<IChatComponentProps> = ({
  setShowScrollButton,
  chatRef,
  socket,
}) => {
  const { chatId } = useParams<{ chatId: string }>()
  if (chatId) localStorage.setItem('chat-id', chatId)
  const [messages, setMessages] = useState<IMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pinnedMessages, setPinnedMessages] = useState<IMessage[]>([])
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const username = localStorage.getItem('username')

  // Загрузка сообщений при смене chatId
  useEffect(() => {
    if (!chatId) return

    setIsLoading(true)

    fetch(`${API_URL}/auth/messages/${chatId}`)
      .then((res) => res.json())
      .then((data: IMessage[]) => {
        setMessages(data)
        setIsLoading(false)

        // Обновляем закрепленные
        const pinned = data.filter((msg) => msg.isPinned)
        setPinnedMessages(pinned)
      })
      .catch((err) => {
        console.error('Error fetching messages:', err)
        setIsLoading(false)
      })
  }, [chatId])

  // Подписка на сокет-события для этого чата
  useEffect(() => {
    if (!socket || !chatId) return

    socket.emit('joinChatRoom', chatId)

    const handleNewMessage = (newMessage: IMessage) => {
      if (newMessage.chatId === chatId) {
        setMessages((prev) => [...prev, newMessage])
      }
    }

    const handlePinned = (pinnedMessage: IMessage) => {
      if (pinnedMessage.chatId === chatId) {
        setPinnedMessages((prev) => [...prev, pinnedMessage])
      }
    }

    const handleUnpinned = (unpinnedMessage: IMessage) => {
      if (unpinnedMessage.chatId === chatId) {
        setPinnedMessages((prev) =>
          prev.filter((msg) => msg._id !== unpinnedMessage._id)
        )
      }
    }

    const handleUpdated = (updatedMessage: IMessage) => {
      if (updatedMessage.chatId !== chatId) return

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === updatedMessage._id
            ? { ...msg, text: updatedMessage.text } // оставляем senderId как есть
            : msg
        )
      )
    }

    const handleDeleted = (deletedMessage: IMessage) => {
      if (deletedMessage.chatId === chatId) {
        setMessages((prev) =>
          prev.filter((el: IMessage) => el._id !== deletedMessage._id)
        )
      }
    }

    socket.on('message', handleNewMessage)
    socket.on('messagePinned', handlePinned)
    socket.on('messageUnpinned', handleUnpinned)
    socket.on('messageDeleted', handleDeleted)
    socket.on('messageEdited', handleUpdated)

    return () => {
      socket.emit('leaveChatRoom', chatId) // выходим из комнаты

      socket.off('message', handleNewMessage)
      socket.off('messagePinned', handlePinned)
      socket.off('messageUnpinned', handleUnpinned)
      socket.off('messageDeleted', handleDeleted)
    }
  }, [socket, chatId])

  // Скролл и отображение кнопки прокрутки
  const handleScroll = () => {
    const chatEl = chatRef.current
    if (!chatEl) return

    const isScrolledUp =
      chatEl.scrollTop + chatEl.clientHeight < chatEl.scrollHeight - 300

    setShowScrollButton(isScrolledUp)
  }

  useEffect(() => {
    const chatEl = chatRef.current
    if (!chatEl) return

    const distanceFromBottom =
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight
    const isAtBottom = distanceFromBottom < 200

    if (isAtBottom) {
      requestAnimationFrame(() => {
        chatEl.scrollTo({
          top: chatEl.scrollHeight,
          behavior: 'smooth',
        })
      })
    }
    handleScroll()
  }, [messages])

  useEffect(() => {
    if (!isLoading && chatRef.current) {
      requestAnimationFrame(() => {
        chatRef.current?.scrollTo({
          top: chatRef.current.scrollHeight,
          behavior: 'auto', // можно 'smooth', если нужно
        })
      })
    }
  }, [isLoading])

  useEffect(() => {
    hasScrolledRef.current = false
  }, [chatId])

  const hasScrolledRef = useRef(false)
  useEffect(() => {
    const chatEl = chatRef.current
    if (!chatEl || hasScrolledRef.current) return

    chatEl.scrollTo({
      top: chatEl.scrollHeight,
      behavior: 'auto',
    })
    hasScrolledRef.current = true
  }, [messages])

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMMM d')
  }

  if (isLoading) {
    return (
      <div className={cl.chat}>
        <div className={cl.clearContainer}>
          <img draggable={false} src={loading} className={cl.isClear} />
        </div>
      </div>
    )
  }

  return (
    <div onScroll={handleScroll} className={cl.chat} ref={chatRef}>
      {/* Можно здесь потом добавить Пин и Поиск */}

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
            {el.senderId.username === username ? (
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
