import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import io, { Socket } from 'socket.io-client'
import { AppDispatch, RootState, store, useAppSelector } from '../../../store'
import { ChatComponent } from '../../../components/Chat/Chat'
import { Interaction } from '../../../components/Interaction/Interaction'
import cl from './rightWindow.module.css'
import { sendMessage } from '../ChatPageUtils'
import { API_URL } from '../../../constants'
import { AnimatePresence, motion } from 'framer-motion'
import { IMessage } from '../../../types/IMessage'
import { ScrollChatButton } from '../../../components/ScrollChatButton/ScrollChatButton'
import closeNotFoundWindowIcon from './images/close-notFound-window.svg'
import { Route, Routes, useParams } from 'react-router-dom'
import { FriendRequestSender } from '../../../components/FriendRequestSender/FriendRequestSender'
import { addChat, setChats, sortChats } from '../../../slices/chatSlice'
import { addOnlineFriend, setOnlineFriends } from '../../../slices/friendsSlice'
import { TestPage } from '../../TestPage/TestPage'
import {
  setNewMessage,
  setNotification,
} from '../../../slices/notificationSlice'
import { Notification } from '../../../components/Notification/Notification'
import {
  addMessageToChat,
  deleteMessageFromChat,
  editMessageInChat,
  unpinMessageInChat,
} from '../../../slices/chatMessages'

interface IRequest {
  avatar: string
  id: string
  username: string
}

export const RightWindow = () => {
  const [message, setMessage] = useState<string>('')
  const { isNotification, newMessage } = useAppSelector(
    (state) => state.notification
  )
  const { chats } = useAppSelector((state) => state.chats)
  const token = useSelector((state: RootState) => state.auth.token)
  const isAuth = !!token
  const [socket, setSocket] = useState<Socket | null>(null)
  const [usersTyping, setUsersTyping] = useState<string[]>([])
  const username = localStorage.getItem('username')
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const replyMessage = useAppSelector((state) => state.reply.message)
  const currentUserId = localStorage.getItem('user-id')
  const [allRequests, setAllRequests] = useState<IRequest[]>([])
  const dispatch = useDispatch<AppDispatch>()
  const { onlineFriends } = useAppSelector((state) => state.friends)

  async function fetchFriendRequests(userId: string) {
    const response = await fetch(`${API_URL}/friends/requests/${userId}`)
    const data = await response.json()

    if (response.ok) {
      return data
    } else {
      console.error('Ошибка при получении заявок:', data.message)
      return []
    }
  }

  useEffect(() => {
    setAllRequests([])
    async function loadRequests() {
      if (!currentUserId) return

      const requests = await fetchFriendRequests(currentUserId)

      requests.forEach((req: any) => {
        setAllRequests((r) => [
          ...r,
          {
            id: req.requesterId._id,
            username: req.requesterId.username,
            avatar: req.requesterId.avatar,
          },
        ])
      })
    }
    loadRequests()
  }, [currentUserId])

  useEffect(() => {
    async function loadUserChats() {
      if (!currentUserId) {
        console.error('ошибка при получении чатов юзера, нет currentUserId')
        return
      }

      try {
        const res = await fetch(`${API_URL}/auth/user-chats/${currentUserId}`)
        const data = await res.json()
        dispatch(setChats(data))
        dispatch(sortChats())
      } catch (e) {
        console.error(`ошибка при получении чатов юзера: ${e}`)
      }
    }

    loadUserChats()
  }, [currentUserId, dispatch])

  let notificationSound: HTMLAudioElement | null = null
  window.addEventListener('click', () => {
    if (!notificationSound) {
      notificationSound = new Audio('/sounds/notification-sound.mp3')
      notificationSound.load()
    }
  })

  const originalTitle = document.title
  let hasNewMessage = false

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && hasNewMessage) {
        document.title = originalTitle
        hasNewMessage = false
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [originalTitle])

  useEffect(() => {
    if (!isAuth || !currentUserId || !token) return

    const newSocket = io(API_URL, {
      query: { userId: currentUserId },
      auth: { token },
      transports: ['websocket'],
    })

    newSocket.on('connect_error', (error) => {
      console.log('Ошибка подключения:', error)
    })

    setSocket(newSocket)

    newSocket.on('onlineChatUsersList', (onlineUserIds: string[]) => {
      console.log('Online Users IDS: ', onlineUserIds)
      dispatch(setOnlineFriends(onlineUserIds))
    })

    newSocket.on('usersTyping', (usernames: string[]) => {
      setUsersTyping(usernames.filter((name) => name !== username))
    })

    newSocket.on('newRequest', (message: IRequest) => {
      setAllRequests((r) => [...r, message])
      console.log(`new request: ${message}`)
      if (document.hidden && notificationSound) {
        notificationSound.pause()
        notificationSound.currentTime = 0
        notificationSound.play().catch((err) => {
          console.warn('Ошибка воспроизведения звука:', err)
        })
      }
      if (document.hidden) {
        hasNewMessage = true
        document.title = 'New Request - Omnio'
      }
    })

    newSocket.on('new-private-chat', (message: any) => {
      const chats = store.getState().chats.chats
      const exists = chats.some((c: any) => c._id === message.chat._id)

      if (!exists) {
        dispatch(addChat(message.chat))
      } else {
        dispatch(
          setChats(chats.filter((el: any) => el._id !== message.chat._id))
        )
        dispatch(addChat(message.chat))
      }

      if (message.isOnline !== null) {
        dispatch(addOnlineFriend(message.isOnline))
      }
    })

    newSocket.on('user-online', (id: string) => {
      console.log('ONLINE:', id)
      dispatch(addOnlineFriend(id))
    })

    newSocket.on('user-offline', (id: string) => {
      console.log('OFFLINE: ', id)
      dispatch(setOnlineFriends(onlineFriends.filter((el: any) => el !== id)))
    })

    newSocket.on('new-message', (message: IMessage) => {
      const currentChatId = localStorage.getItem('chat-id')
      if (currentChatId?.toString() !== message.chatId.toString()) {
        dispatch(
          addMessageToChat({ chatId: message.chatId.toString(), message })
        )

        dispatch(
          setChats((prevChats: any) =>
            prevChats.map((chat: any) =>
              chat._id.toString() === message.chatId.toString()
                ? { ...chat, isNewMessage: true }
                : chat
            )
          )
        )
        console.log(chats)
        dispatch(setNotification(true))
        dispatch(
          setNewMessage({
            avatar: message.senderId.avatar,
            username: message.senderId.username,
            text: message.text,
            chatId: message.chatId,
          })
        )
        if (notificationSound) {
          notificationSound.pause()
          notificationSound.currentTime = 0
          notificationSound.play().catch((err) => {
            console.warn('Ошибка воспроизведения звука:', err)
          })
        }
      }
    })

    newSocket.on('new-pinned', (message: IMessage) => {
      dispatch(
        pinMessageInChat({ chatId: message.chatId, messageId: message._id })
      )
    })

    newSocket.on('new-unpin', (message: IMessage) => {
      dispatch(
        unpinMessageInChat({ chatId: message.chatId, messageId: message._id })
      )
    })

    newSocket.on('new-delete', (message: IMessage) => {
      dispatch(
        deleteMessageFromChat({
          chatId: message.chatId,
          messageId: message._id,
        })
      )
    })

    newSocket.on('new-edit', (message: IMessage) => {
      dispatch(
        editMessageInChat({
          chatId: message.chatId,
          messageId: message._id,
          newText: message.text,
        })
      )
    })

    return () => {
      newSocket.disconnect()
    }
  }, [isAuth, currentUserId, token, username, dispatch])

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  return (
    <Routes>
      <Route
        path="/chat/:chatId"
        element={
          <div style={{ background: 'black', height: '100vh' }}>
            <div className={cl.chatPage}>
              <ChatComponent
                socket={socket}
                chatRef={chatRef}
                setShowScrollButton={setShowScrollButton}
              />
              {/* <AnimatePresence>
                {usersTyping.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    exit={{ opacity: 0 }}
                    className={cl.typingDiv}
                  >
                    <span className={cl.dot}>.</span>
                    <span className={cl.dot}>.</span>
                    <span className={cl.dot}>.</span>
                  </motion.div>
                )}
              </AnimatePresence> */}
              <ScrollChatButton
                onClick={scrollToBottom}
                isVisible={showScrollButton}
              />
              <Interaction
                socket={socket}
                message={message}
                setMessage={setMessage}
                sendMessage={() =>
                  sendMessage(socket, message, setMessage, replyMessage)
                }
              />
            </div>
          </div>
        }
      />
      <Route
        path="friends/*"
        element={
          <FriendRequestSender
            allRequests={allRequests}
            setAllRequests={setAllRequests}
            currentUserId={currentUserId}
            socket={socket}
          />
        }
      />
      <Route path="flux-subscription" element={<div />} />
      <Route path="test" element={<TestPage />} />
    </Routes>
  )
}
function pinMessageInChat(arg0: { chatId: string; messageId: string }): any {
  throw new Error('Function not implemented.')
}
