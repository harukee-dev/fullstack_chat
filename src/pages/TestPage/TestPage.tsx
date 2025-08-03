import { useDispatch } from 'react-redux'
import { FriendRequestSender } from '../../components/FriendRequestSender/FriendRequestSender'
import { Interaction } from '../../components/Interaction/Interaction'
import { MessageInteraction } from '../../components/MessageInteraction/MessageInteraction'
import { AppDispatch, useAppSelector } from '../../store'
import { useEffect } from 'react'
import { Notification } from '../../components/Notification/Notification'
import { setNotification } from '../../slices/notificationSlice'

export const TestPage = () => {
  const currentUserId = localStorage.getItem('user-id')
  const { isNotification } = useAppSelector((state) => state.notification)
  console.log(currentUserId)
  const dispatch = useDispatch<AppDispatch>()

  return (
    <div>
      <h1 style={{ color: 'white' }}>TestPage</h1>
      <button onClick={() => dispatch(setNotification(true))}>set</button>
      {isNotification === true && (
        <Notification
          avatar="https://i.pinimg.com/736x/83/46/ff/8346fff047f78eb27665ee9594d475a4.jpg"
          username="harukee"
          text="Здаров братишка шо как сам чем занимаешься как день проходить"
          chatId="ads"
        />
      )}
    </div>
  )
}
