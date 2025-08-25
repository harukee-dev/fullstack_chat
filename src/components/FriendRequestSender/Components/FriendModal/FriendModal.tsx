import { useDispatch } from 'react-redux'
import cl from './friendModal.module.css'
import { AppDispatch, useAppSelector } from '../../../../store'
import { setIsOpened } from '../../../../slices/userProfileSlice'
import { easeInOut, easeOut, motion } from 'framer-motion'
import { API_URL } from '../../../../constants'
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

interface IFriendModal {
  username: string
  avatar: string
  description: string
  isOnline: boolean
  userId: string
  banner: string
}

export const FriendModal: React.FC<IFriendModal> = ({
  username,
  avatar,
  description,
  isOnline,
  userId,
  banner,
}) => {
  const socket = useRef<Socket | null>(null)
  const { chats } = useAppSelector((state) => state.chats)
  const navigate = useNavigate()
  const chat = chats.find((c: any) =>
    c.members.some((m: any) => m._id === userId)
  )._id
  const { onlineFriends } = useAppSelector((state) => state.friends)
  const isUserOnline = onlineFriends.includes(userId)
  const dispatch = useDispatch<AppDispatch>()
  const currentUserId = localStorage.getItem('user-id')
  const token = useAppSelector((state) => state.auth.token)

  useEffect(() => {
    if (!currentUserId || !token) return

    socket.current = io(API_URL, {
      query: { userId: currentUserId },
      auth: { token },
      transports: ['websocket'],
    })

    return () => {
      socket.current?.disconnect()
      socket.current = null
    }
  }, [currentUserId, token])

  const handleClose = (e: any) => {
    if (e.target === e.currentTarget) {
      dispatch(setIsOpened(false))
    }
  }

  const handleMessage = () => {
    navigate(`/main/chat/${chat}`)
    dispatch(setIsOpened(false))
  }

  const handleDeleteFriend = async (
    requesterId: string,
    recipientId: string
  ) => {
    try {
      console.log(requesterId, recipientId)
      await fetch(API_URL + '/friends/deleteFriend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientId, requesterId }),
      })
      if (socket.current) {
        socket.current.emit('joinPersonalRoom', currentUserId)
        socket.current.emit('sendFriendDeleted', {
          user1: requesterId,
          user2: recipientId,
        })
        dispatch(setIsOpened(false))
      }
    } catch (e) {
      console.log('Error fetching post "DELETE-FRIEND": ', e)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => handleClose(e)}
      className={cl.firstContainer}
    >
      <motion.div
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.75, opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease: easeOut }}
        className={cl.mainContainer}
      >
        <img className={cl.banner} src={banner} alt="BANNER" />
        <div className={cl.avatarAndInfoContainer}>
          <img className={cl.avatar} src={avatar} alt="AVATAR" />
          <div className={cl.infoAndButtonsContainer}>
            <div className={cl.nicknameAndStatusContainer}>
              <p className={cl.nickname}>{username}</p>
              <div className={cl.indicatorAndStatusContainer}>
                <div
                  className={
                    isUserOnline ? cl.onlineIndicator : cl.offlineIndicator
                  }
                />
                <p
                  className={isUserOnline ? cl.onlineStatus : cl.offlineStatus}
                >
                  {isUserOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
            <div className={cl.buttonsContainer}>
              <button onClick={handleMessage} className={cl.button}>
                Message
              </button>
              <button className={cl.button}>Call</button>
              <button
                onClick={() =>
                  currentUserId && handleDeleteFriend(userId, currentUserId)
                }
                className={cl.deleteButton}
              >
                Remove friend
              </button>
            </div>
          </div>
        </div>
        <div className={cl.userDescriptionContainer}>
          <p className={cl.userDescriptionTitle}>About me:</p>
          <p className={cl.userDescriptionSubtitle}>{description}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}
