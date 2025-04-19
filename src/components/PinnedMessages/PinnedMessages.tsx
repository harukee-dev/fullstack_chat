import React from 'react'
import { IMessage } from '../../types/IMessage'
import cl from './pinnedMessages.module.css'
import pinIcon from './images/pin-icon.svg'

interface IPinnedMessagesProps {
  pinnedMessages: IMessage[]
}

export const PinnedMessages: React.FC<IPinnedMessagesProps> = ({
  pinnedMessages,
}) => {
  const pinned = {
    username: 'mxkmixka',
    text: 'this is pinned message',
  }

  return (
    <div className={cl.container}>
      <div
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
          {pinnedMessages[pinnedMessages.length - 1].text}
        </p>
      </div>
    </div>
  )
}
