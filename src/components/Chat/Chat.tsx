import { useEffect, useRef } from 'react'
import { Message } from '../Message/Message'
import cl from './chat.module.css'
import Duck from '../../images/duck_chat_is_clear.png'

interface IMessage {
  username: string
  text: string
}

interface IChatProps {
  messages: IMessage[] | []
  isClear: boolean
}

export const ChatComponent: React.FC<IChatProps> = ({ messages, isClear }) => {
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  if (isClear) {
    return (
      <div className={cl.chat}>
        <div className={cl.clearContainer}>
          <p className={cl.isClear}>Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cl.chat} ref={chatRef}>
      {messages.map((el, index) => (
        <Message key={index} message={el.text} username={el.username} />
      ))}
    </div>
  )
}
