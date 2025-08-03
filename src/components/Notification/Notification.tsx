import cl from './notification.module.css'
import closeIcon from './images/close-notification-icon.svg'
import { motion } from 'framer-motion'
import React from 'react'
import { AppDispatch, useAppSelector } from '../../store'
import { useDispatch } from 'react-redux'
import { setNotification } from '../../slices/notificationSlice'

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

  const handleClose = () => {
    dispatch(setNotification(false))
  }
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={cl.notificationContainer}
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
