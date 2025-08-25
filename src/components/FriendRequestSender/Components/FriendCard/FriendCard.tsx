import React, { useState } from 'react'
import cl from './friendCard.module.css'
import deleteFriendIcon from './images/delete-friend.png'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../../../store'
import {
  setIsOpened,
  setUserModalData,
} from '../../../../slices/userProfileSlice'

interface IFriend {
  avatar: string
  username: string
  id: string
  description: string
  isOnline: boolean
  banner: string | null
}

interface IFriendCard {
  currentUserId: string
  friendData: IFriend
}

export const FriendCard: React.FC<IFriendCard> = ({
  currentUserId,
  friendData,
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const handleClick = () => {
    dispatch(
      setUserModalData({
        username: friendData.username,
        description:
          friendData.description !== '' ? friendData.description : 'Clear',
        avatar: friendData.avatar,
        isOnline: friendData.isOnline,
        userId: friendData.id,
        banner:
          friendData.banner ||
          'https://i.pinimg.com/1200x/a1/10/0a/a1100a7d501b743aff598359c55e6dc0.jpg',
      })
    )
    dispatch(setIsOpened(true))
  }

  return (
    <div
      key={friendData.username}
      className={cl.friendContainer}
      onClick={handleClick}
      onMouseMove={(e) => {
        const card = e.currentTarget as HTMLDivElement
        const rect = card.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((y - centerY) / centerY) * -20
        const rotateY = ((x - centerX) / centerX) * 20

        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`

        const glare = card.querySelector('::before') as HTMLElement
        const percentX = (x / rect.width) * 100
        const percentY = (y / rect.height) * 100
        card.style.setProperty('--glare-x', `${percentX}%`)
        card.style.setProperty('--glare-y', `${percentY}%`)
        card.style.setProperty('--glare-opacity', `1`)
      }}
      onMouseLeave={(e) => {
        const card = e.currentTarget as HTMLDivElement
        card.style.transform = 'rotateX(0deg) rotateY(0deg)'
        card.style.setProperty('--glare-opacity', `0`)
      }}
    >
      <img
        draggable={false}
        src={friendData.avatar}
        className={cl.avatarOnline}
        alt="user-avatar"
      />
      <p className={cl.friendUsername} style={{ color: 'white' }}>
        {friendData.username}
      </p>
    </div>
  )
}
