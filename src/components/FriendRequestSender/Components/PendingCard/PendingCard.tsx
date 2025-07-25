import { useState } from 'react'
import cl from './pendingCard.module.css'

interface IPendingCard {
  pending: any
  handleAccept: any
  handleReject: any
  currentUserId: string
}

export const PendingCard: React.FC<IPendingCard> = ({
  pending,
  handleAccept,
  handleReject,
  currentUserId,
}) => {
  const [isDisabled, setIsDisabled] = useState<boolean>(false)

  const acceptFunc = () => {
    setIsDisabled(true)
    handleAccept(pending.id, currentUserId)
  }

  const rejectFunc = () => {
    setIsDisabled(true)
    handleReject(pending.id, currentUserId)
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
      }}
      className={cl.pendingCard}
      key={pending.id}
    >
      <img
        draggable={false}
        className={cl.pendingAvatar}
        src={pending.avatar}
        alt="avatar"
      />
      <p className={cl.pendingUsername} style={{ color: 'white' }}>
        {pending.username}
      </p>
      <div className={cl.buttonsContainer}>
        <button
          disabled={isDisabled}
          className={cl.buttonAccept}
          onClick={() => acceptFunc()}
        >
          Accept
        </button>
        <button
          disabled={isDisabled}
          className={cl.buttonReject}
          onClick={() => rejectFunc()}
        >
          Decline
        </button>
      </div>
    </div>
  )
}
