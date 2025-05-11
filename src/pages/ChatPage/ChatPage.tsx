import { useEffect } from 'react'
import { useAppSelector } from '../../store'
import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'
import cl from './ChatPage.module.css'

export const Chat = () => {
  const currentUser = useAppSelector((state) => state.currentUser.user)
  useEffect(() => {
    localStorage.setItem('user-id', currentUser._id)
    console.log(localStorage.getItem('user-id'))
  }, [currentUser])
  return (
    <div className={cl.body}>
      <LeftWindow />
      <RightWindow />
    </div>
  )
}
