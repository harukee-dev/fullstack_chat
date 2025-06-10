import { useEffect } from 'react'
import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'
import cl from './ChatPage.module.css'
import { setFriends } from '../../slices/friendsSlice'
import { API_URL } from '../../constants'
import { useDispatch } from 'react-redux'
import { AppDispatch, useAppSelector } from '../../store'

export const Chat = () => {
  const currentUserId = localStorage.getItem('user-id') || 'none'
  const dispatch = useDispatch<AppDispatch>()
  const friends = useAppSelector((state) => state.friends.friends)

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
    </div>
  )
}
