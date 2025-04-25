import React, { useState } from 'react'
import { IMessage } from '../../types/IMessage'
import cl from './pinnedMessages.module.css'
import pinIcon from './images/pin-icon.svg'

interface IPinnedMessagesProps {
  pinnedMessages: IMessage[]
  messageRefs: any
}

export const PinnedMessages: React.FC<IPinnedMessagesProps> = ({
  pinnedMessages,
  messageRefs,
}) => {
  const [pinnedIndex, setPinnedIndex] = useState<number>(1)

  const scrollToMessage = (id: string) => {
    const target = messageRefs[id]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleClick = () => {
    scrollToMessage(pinnedMessages[pinnedMessages.length - pinnedIndex]._id)
    if (pinnedMessages.length - pinnedIndex <= 0) {
      setPinnedIndex(1)
    } else {
      setPinnedIndex((i) => i + 1)
    }
  }

  return (
    <div className={cl.container}>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.1vh',
          cursor: 'pointer',
        }}
      >
        <p className={cl.username}>
          {/* {pinnedMessages[pinnedMessages.length - 1].username} */}
          Pinned Message
        </p>
        <p className={cl.text}>
          {pinnedMessages[pinnedMessages.length - pinnedIndex].text}
        </p>
      </div>
    </div>
  )
}
