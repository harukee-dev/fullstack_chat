import { useEffect } from 'react'
import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'
import cl from './ChatPage.module.css'
import { setFriends } from '../../slices/friendsSlice'
import { API_URL } from '../../constants'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'

export const Chat = () => {
  const currentUserId = localStorage.getItem('user-id') || 'none'
  const dispatch = useDispatch<AppDispatch>()

  const fetchFriends = async (userId: string) => {
    const response = await fetch(API_URL + '/friends/list/' + userId)
    dispatch(setFriends(response.ok ? await response.json() : []))
  }

  useEffect(() => {
    fetchFriends(currentUserId)
  }, [])

  return (
    <div className={cl.body}>
      <LeftWindow />
      <RightWindow />
    </div>
  )
}
