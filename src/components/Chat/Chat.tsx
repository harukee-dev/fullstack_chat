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
import { AnimatePresence, motion } from 'framer-motion'
import closeNotFoundWindowIcon from '../../pages/ChatPage/RightWindow/images/close-notFound-window.svg'
import { AppDispatch, useAppSelector } from '../../store'
import { useDispatch } from 'react-redux'
import { updateChat } from '../../slices/chatSlice'
import { addMessageToChat, setMessagesForChat } from '../../slices/chatMessages'
import { removeReplyMessage } from '../../slices/replyMessageSlice'

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
  const { chats } = useAppSelector((state) => state.chats)
  const [messages, setMessages] = useState<IMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pinnedMessages, setPinnedMessages] = useState<IMessage[]>([])
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const username = localStorage.getItem('username')
  const [isPanelOpened, setIsPanelOpened] = useState<boolean>(false)
  const [isNotFound, setIsNotFound] = useState<boolean>(false)
  const [isShowPinnedMessages, setIsShowPinnedMessages] =
    useState<boolean>(false)
  const dispatch = useDispatch<AppDispatch>()
  const { chatId } = useParams<{ chatId: string }>()
  const { messagesByChatId } = useAppSelector((state) => state.messagesByChatId)
  const currentChatName = localStorage.getItem('current-chat-name')
  const replyMessage = useAppSelector((state) => state.reply.message)
  const [isReply, setIsReply] = useState<boolean>(false)

  useEffect(() => {
    setIsReply(replyMessage !== null)
  }, [replyMessage])

  useEffect(() => {
    hasScrolledRef.current = false
    const chatEl = chatRef.current
    if (!chatEl || hasScrolledRef.current) return

    chatEl.scrollTo({
      top: chatEl.scrollHeight,
      behavior: 'auto',
    })
    hasScrolledRef.current = true
  }, [isReply])

  useEffect(() => {
    if (chatId) localStorage.setItem('chat-id', chatId)
    dispatch(removeReplyMessage())

    return () => localStorage.setItem('chat-id', '')
  }, [chatId])

  useEffect(() => {
    if (!chatId) return

    const cachedMessages = messagesByChatId[chatId]
    if (cachedMessages) {
      setMessages(cachedMessages)

      const pinned = cachedMessages.filter((msg) => msg.isPinned)
      setPinnedMessages(pinned)

      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetch(`${API_URL}/auth/messages/${chatId}`)
      .then((res) => res.json())
      .then((data: IMessage[]) => {
        dispatch(setMessagesForChat({ chatId, messages: data }))
        setMessages(data)

        const pinned = data.filter((msg) => msg.isPinned)
        setPinnedMessages(pinned)

        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [chatId])

  useEffect(() => {
    if (!socket || !chatId) return

    socket.emit('joinChatRoom', chatId)

    const handleNewMessage = (newMessage: IMessage) => {
      if (newMessage.chatId.toString() === chatId.toString()) {
        setMessages((prev) => [...prev, newMessage])
      }
    }

    const handlePinned = (pinnedMessage: IMessage) => {
      if (pinnedMessage.chatId.toString() === chatId.toString()) {
        setPinnedMessages((prev) => [...prev, pinnedMessage])
        console.log('PINNED ', pinnedMessage)
      }
    }

    const handleUnpinned = (unpinnedMessage: IMessage) => {
      if (unpinnedMessage.chatId.toString() === chatId.toString()) {
        setPinnedMessages((prev) =>
          prev.filter((msg) => msg._id !== unpinnedMessage._id)
        )
        console.log('UNPINNED: ', pinnedMessages)
      }
    }

    const handleUpdated = (updatedMessage: IMessage) => {
      if (updatedMessage.chatId !== chatId) return

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === updatedMessage._id
            ? { ...msg, text: updatedMessage.text }
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

    const handleChatUpdated = (message: any) => {
      dispatch(updateChat(message))
    }

    socket.on('message', handleNewMessage)
    socket.on('messagePinned', handlePinned)
    socket.on('messageUnpinned', handleUnpinned)
    socket.on('messageDeleted', handleDeleted)
    socket.on('messageEdited', handleUpdated)
    socket.on('chatUpdated', handleChatUpdated)

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
  }, [messages, isShowPinnedMessages])

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

  const handlePanelOpen = () => {
    setIsPanelOpened((p) => !p)
  }

  const handleShowPinned = () => {
    setIsShowPinnedMessages((prev) => !prev)
    const chatEl = chatRef.current
    if (!chatEl) return

    const distanceFromBottom =
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight
    const isAtBottom = distanceFromBottom < 200

    if (isAtBottom) {
      requestAnimationFrame(() => {
        chatEl.scrollTo({
          top: chatEl.scrollHeight,
          behavior: 'auto',
        })
      })
    }
    handleScroll()
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

  const handleSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', margin: '0', padding: '0' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className={cl.light}
      />
      <div className={cl.chatHeader}>
        <div style={{ display: 'flex', gap: '.6vh' }}>
          <p className={cl.hashtag}>#</p>
          <p className={cl.chatName}>{currentChatName}</p>
        </div>
        <button onClick={handlePanelOpen} className={cl.buttonOther}>
          ···
        </button>
      </div>
      <ChatPanel
        setIsNotFound={setIsNotFound}
        isNotFound={isNotFound}
        isOpened={isPanelOpened}
        isShowPinned={isShowPinnedMessages}
        handleShowPinned={handleShowPinned}
        handleSearch={handleSearch}
      />
      <div
        onScroll={handleScroll}
        className={isReply ? cl.chatWithPaddingBottom : cl.chat}
        ref={chatRef}
      >
        {/* Можно здесь потом добавить Пин и Поиск */}

        {(isShowPinnedMessages ? pinnedMessages : messages).map((el, index) => {
          const currentMessageDate = new Date(el.timestamp ?? new Date())
          const prevMessage = isShowPinnedMessages
            ? pinnedMessages[index - 1]
            : messages[index - 1]
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
    </div>
  )
}

interface IChatPanel {
  isShowPinned: boolean
  handleShowPinned: () => void
  handleSearch: (arg: any) => void
  isOpened: boolean
  setIsNotFound: React.Dispatch<React.SetStateAction<boolean>>
  isNotFound: boolean
}

const ChatPanel: React.FC<IChatPanel> = ({
  isShowPinned,
  handleShowPinned,
  handleSearch,
  isOpened,
  setIsNotFound,
  isNotFound,
}) => {
  return (
    <div>
      <AnimatePresence>
        {isOpened && (
          <motion.div
            initial={{ opacity: 0, x: 5, y: -5 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.2 }}
            exit={{ opacity: 0, x: 5, y: -5 }}
            className={cl.panelContainer}
          >
            <button onClick={handleShowPinned} className={cl.panelButton}>
              Show {isShowPinned ? 'all' : 'pinned'} messages
            </button>
            <input
              onKeyDown={handleSearch}
              className={cl.panelInput}
              type="text"
              placeholder="Search message"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isNotFound && (
          <motion.div
            className={cl.notFoundWindowContainer}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            exit={{ opacity: 0 }}
          >
            <button
              onClick={() => setIsNotFound(false)}
              className={cl.notFoundWindowButton}
            >
              <img draggable={false} src={closeNotFoundWindowIcon} alt="" />
            </button>
            <p className={cl.notFoundWindowText}>No messages found</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
