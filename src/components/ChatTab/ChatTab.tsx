import React from 'react'
import { ChatTabProps } from './typesChatTab'
import cl from './ChatTab.module.css'
import closeIcon from './images/close-chat.svg'
import { useNavigate } from 'react-router-dom'

export const ChatTab: React.FC<ChatTabProps> = ({
  username,
  avatar,
  isOnline,
  chatId, // заменили navigate на chatId
}) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/main/chat/${chatId}`)
  }

  return (
    <div onClick={handleClick} className={cl.container}>
      <div>
        {avatar ? (
          <img
            draggable={false}
            className={isOnline ? cl.avatarOnline : cl.avatarOffline}
            src={avatar}
            alt="avatar"
          />
        ) : (
          <div className={cl.defaultAvatar}>
            <p className={cl.defaultAvatarText}>
              {username.charAt(0).toUpperCase()}
            </p>
          </div>
        )}
      </div>
      <p className={cl.username}>{username}</p>
      <img
        draggable={false}
        className={cl.closeIcon}
        src={closeIcon}
        alt="close-icon"
      />
    </div>
  )
}
