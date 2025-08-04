import cl from './notification.module.css'
import closeIcon from './images/close-notification-icon.svg'
import { AnimatePresence, motion } from 'framer-motion'
import React, { useEffect } from 'react'
import { AppDispatch, useAppSelector } from '../../store'
import { useDispatch } from 'react-redux'
import { setNotification } from '../../slices/notificationSlice'
import { useNavigate } from 'react-router-dom'
import { setChats } from '../../slices/chatSlice'

interface INotification {
  avatar: string
  username: string
  text: string
  chatId: string
}

export const Notification: React.FC<INotification> = ({
  avatar,
  username,
  text,
  chatId,
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setNotification(false))
    }, 5000)

    return () => clearTimeout(timer)
  }, [dispatch])

  const handleClose = () => {
    dispatch(setNotification(false))
  }

  const handleClick = () => {
    navigate('/main/chat/' + chatId)
    dispatch(setNotification(false))
    dispatch(
      setChats((prevChats: any) =>
        prevChats.map((chat: any) =>
          chat._id.toString() === chatId.toString()
            ? { ...chat, isNewMessage: false }
            : chat
        )
      )
    )
  }
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cl.notificationContainer}
      onClick={handleClick}
    >
      <img
        onClick={handleClose}
        className={cl.closeButton}
        src={closeIcon}
        alt="close-icon"
      />
      <div className={cl.avatarAndNicknameContainer}>
        <img className={cl.avatar} src={avatar} alt="user-avatar" />
        <div className={cl.nicknameContainer}>
          <p className={cl.nickname}>{username}</p>
          <p className={cl.description}>{text}</p>
        </div>
      </div>
    </motion.div>
  )
}
