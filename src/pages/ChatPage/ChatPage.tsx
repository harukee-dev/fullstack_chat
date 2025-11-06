import { useEffect } from 'react'
import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'
import cl from './ChatPage.module.css'
import { setFriends } from '../../slices/friendsSlice'
import { API_URL } from '../../constants'
import { useDispatch } from 'react-redux'
import { AppDispatch, useAppSelector } from '../../store'
import { Notification } from '../../components/Notification/Notification'
import { AnimatePresence } from 'framer-motion'
import { FriendModal } from '../../components/FriendRequestSender/Components/FriendModal/FriendModal'
import { useNavigate } from 'react-router-dom'

export const Chat = () => {
  const currentUserId = localStorage.getItem('user-id') || 'none'
  const { isNotification, newMessage } = useAppSelector(
    (state) => state.notification
  )
  const dispatch = useDispatch<AppDispatch>()
  const friends = useAppSelector((state) => state.friends.friends)
  const { isOpened, username, avatar, description, isOnline, userId, banner } =
    useAppSelector((state) => state.userProfileModal)
  const navigate = useNavigate()

  const fetchFriends = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/friends/list/${userId}`)
      const data = await response.json()

      if (response.ok) {
        dispatch(setFriends(data))
      } else {
        dispatch(setFriends([]))
      }
    } catch (error) {
      console.error('Ошибка при загрузке друзей:', error)
      dispatch(setFriends([]))
    }
  }

  useEffect(() => {
    fetchFriends(currentUserId)
    console.log('fetching friends')
  }, [])

  useEffect(() => {
    console.log('Друзья обновились:', friends)
  }, [friends])

  return (
    <div className={cl.body}>
      <LeftWindow />
      <RightWindow />
      <AnimatePresence>
        {isNotification && (
          <Notification
            avatar={newMessage.avatar}
            username={newMessage.username}
            text={newMessage.text}
            chatId={newMessage.chatId}
          />
        )}
        {isOpened && (
          <FriendModal
            username={username}
            avatar={avatar}
            description={description}
            isOnline={isOnline}
            userId={userId}
            banner={
              banner !== ''
                ? banner
                : 'https://i.pinimg.com/736x/ff/6a/fc/ff6afc47e9e5489d99b3acf3e07c22c8.jpg'
            }
          />
        )}
      </AnimatePresence>
      <button
        className={cl.navigateTestButton}
        onClick={() => navigate('/test')}
      >
        test
      </button>
    </div>
  )
}
