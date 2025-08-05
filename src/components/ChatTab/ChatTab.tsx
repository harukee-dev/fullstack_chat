import React from 'react'
import { ChatTabProps } from './typesChatTab'
import cl from './ChatTab.module.css'
import closeIcon from './images/close-chat.svg'
import { useNavigate } from 'react-router-dom'
import { AppDispatch, useAppSelector } from '../../store'
import { useDispatch } from 'react-redux'
import { setChats } from '../../slices/chatSlice'

export const ChatTab: React.FC<ChatTabProps> = ({
  username,
  avatar,
  isOnline,
  chatId,
  isNewMessage,
}) => {
  const navigate = useNavigate()
  const { chats } = useAppSelector((state) => state.chats)
  const dispatch = useDispatch<AppDispatch>()

  const handleClick = () => {
    const updatedChats = chats.map((chat: any) =>
      chat._id.toString() === chatId.toString()
        ? { ...chat, isNewMessage: false }
        : chat
    )
    localStorage.setItem('current-chat-name', username)
    dispatch(setChats(updatedChats))
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
      <p className={isNewMessage ? cl.usernameNewMessage : cl.username}>
        {username}
      </p>
      {isNewMessage && <div className={cl.newMessageIndicator} />}
    </div>
  )
}
