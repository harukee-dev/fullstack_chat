import { ChatTab } from '../ChatTab/ChatTab'
import { ChatsListProps } from './TypesChatsList'
import cl from './ChatsList.module.css'

export const ChatsList: React.FC<ChatsListProps> = ({ users }) => {
  return (
    <div className={cl.chatsList}>
      {users.map((el, index) => (
        <ChatTab
          key={index}
          username={el.username}
          avatar={el.avatar}
          isOnline={el.isOnline}
        />
      ))}
    </div>
  )
}
