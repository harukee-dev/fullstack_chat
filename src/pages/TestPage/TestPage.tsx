import { useDispatch } from 'react-redux'
import { FriendRequestSender } from '../../components/FriendRequestSender/FriendRequestSender'
import { Interaction } from '../../components/Interaction/Interaction'
import { MessageInteraction } from '../../components/MessageInteraction/MessageInteraction'
import { AppDispatch, useAppSelector } from '../../store'
import { useEffect } from 'react'

export const TestPage = () => {
  const currentUserId = localStorage.getItem('user-id')
  console.log(currentUserId)

  return (
    <div>{/* <FriendRequestSender currentUserId={currentUserId} /> */}</div>
  )
}
