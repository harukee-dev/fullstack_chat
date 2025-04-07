import { useEffect, useRef } from 'react'
import { Message } from '../Message/Message'
import cl from './chat.module.css'
import { MyMessage } from '../Message/MyMessage'

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
      {messages.map((el, index) =>
        el.username === localStorage.getItem('username') ? (
          <MyMessage key={index} message={el.text} username={el.username} />
        ) : (
          <Message key={index} message={el.text} username={el.username} />
        )
      )}
    </div>
  )
}
