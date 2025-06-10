import React, { useState } from 'react'
import cl from './friendCard.module.css'
import deleteFriendIcon from './images/delete-friend.png'

interface IFriend {
  avatar: string
  username: string
  id: string
}

interface IFriendCard {
  deleteFunc: (requesterId: string, recipientId: string) => void
  currentUserId: string
  friendData: IFriend
}

export const FriendCard: React.FC<IFriendCard> = ({
  deleteFunc,
  currentUserId,
  friendData,
}) => {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleClick = () => {
    setIsFlipped((a) => !a)
  }

  return (
    <div
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
        setIsFlipped(false)
      }}
      className={cl.flipCard}
    >
      <div className={`${cl.flipCardInner} ${isFlipped ? cl.flipped : ''}`}>
        <div
          key={friendData.username}
          className={cl.friendContainer}
          //   onClick={() => deleteFunc(friendData.id, currentUserId)}
          onClick={handleClick}
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
        <div onClick={handleClick} className={cl.friendContainerBack}>
          <button
            onClick={() => deleteFunc(friendData.id, currentUserId)}
            className={cl.deleteFriendButton}
          >
            <img
              draggable={false}
              className={cl.deleteFriendIcon}
              src={deleteFriendIcon}
              alt="delete-friend"
            />
          </button>
          <p className={cl.friendUsername}>Delete?</p>
        </div>
      </div>
    </div>
  )
}
