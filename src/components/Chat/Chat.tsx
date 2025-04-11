import { useEffect, useRef } from 'react'
import { Message } from '../Message/Message'
import cl from './chat.module.css'
import { MyMessage } from '../Message/MyMessage'
import { IMessage } from '../../types/IMessage'
// @ts-ignore
import loading from './images/loading.gif'

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
          <img src={loading} className={cl.isClear} />
        </div>
      </div>
    )
  }

  return (
    <div className={cl.chat} ref={chatRef}>
      {messages.map((el, index) =>
        el.username === localStorage.getItem('username') ? (
          <MyMessage
            key={index}
            message={el.text}
            timestamp={el.timestamp || '"01 Jan 1970 00:00:00 GMT"'}
          />
        ) : (
          <Message
            key={index}
            message={el.text}
            username={el.username}
            timestamp={el.timestamp || '"01 Jan 1970 00:00:00 GMT"'}
          />
        )
      )}
    </div>
  )
}
