import { ChatTab } from '../ChatTab/ChatTab'
import cl from './ChatsList.module.css'
import { useAppSelector } from '../../store'
import { useEffect, useState } from 'react'

export const ChatsList: React.FC = ({}) => {
  const currentUserId = localStorage.getItem('user-id')

  const { chats } = useAppSelector((state) => state.chats)
  const { onlineFriends } = useAppSelector((state) => state.friends)

  const sortedChats = Array.isArray(chats)
    ? [...chats].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    : []

  return (
    <div className={cl.chatsList}>
      <div className={cl.addGroupContainer}>
        <p className={cl.addGroupText}>Add Group</p>
        <p className={cl.addGroupPlus}>+</p>
      </div>
      {Array.isArray(chats) &&
        sortedChats.map((el, index) => {
          const chatUser = el.members.find(
            (el: any) => el._id !== currentUserId
          )

          if (!chatUser) {
            return null
          }

          const isOnline = onlineFriends.includes(chatUser._id)
          return (
            <ChatTab
              key={el._id}
              username={chatUser.username}
              avatar={chatUser.avatar}
              isOnline={isOnline}
              chatId={el._id}
            />
          )
        })}
    </div>
  )
}
