import { ChatTab } from '../ChatTab/ChatTab'
import cl from './ChatsList.module.css'
import { useAppSelector } from '../../store'

export const ChatsList: React.FC = ({}) => {
  const currentUserId = localStorage.getItem('user-id')

  const { chats } = useAppSelector((state) => state.chats)

  return (
    <div className={cl.chatsList}>
      <div className={cl.addGroupContainer}>
        <p className={cl.addGroupText}>Add Group</p>
        <p className={cl.addGroupPlus}>+</p>
      </div>
      {Array.isArray(chats) &&
        chats.map((el, index) => {
          const chatUser = el.members.find(
            (el: any) => el._id !== currentUserId
          )

          if (!chatUser) {
            return null
          }
          return (
            <ChatTab
              key={el._id}
              username={chatUser.username}
              avatar={chatUser.avatar}
              isOnline={chatUser.online}
              chatId={el._id}
            />
          )
        })}
    </div>
  )
}
