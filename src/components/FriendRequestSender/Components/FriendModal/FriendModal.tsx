import { useDispatch } from 'react-redux'
import cl from './friendModal.module.css'
import { AppDispatch, useAppSelector } from '../../../../store'
import { setIsOpened } from '../../../../slices/userProfileSlice'
import { easeInOut, easeOut, motion } from 'framer-motion'

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
  const { onlineFriends } = useAppSelector((state) => state.friends)
  const isUserOnline = onlineFriends.includes(userId)
  const dispatch = useDispatch<AppDispatch>()

  const handleClose = (e: any) => {
    if (e.target === e.currentTarget) {
      dispatch(setIsOpened(false))
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
              <button className={cl.button}>Message</button>
              <button className={cl.button}>Call</button>
              <button className={cl.deleteButton}>Remove friend</button>
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
