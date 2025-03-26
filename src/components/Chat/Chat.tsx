import { Message } from '../Message/Message'
import cl from './chat.module.css'
import Duck from '../../images/duck_chat_is_clear.png'

interface IMessage {
  name: string
  message: string
}

interface IChatProps {
  messages: IMessage[] | []
  isClear: boolean
}

export const ChatComponent: React.FC<IChatProps> = ({ messages, isClear }) => {
  if (isClear) {
    return (
      <div className={cl.chat}>
        <div className={cl.clearContainer}>
          <img className={cl.duck} src={Duck} alt="duck image" />
          <h1 className={cl.isClear}>
            Отправьте ваше первое <br /> сообщение!
          </h1>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className={cl.chat}>
        {messages.map((el) => (
          <Message message={el.message} username={el.name} />
        ))}
      </div>
    </>
  )
}
