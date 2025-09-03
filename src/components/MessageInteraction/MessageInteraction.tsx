import cl from './messageInteraction.module.css'
import replyIcon from './images/reply.png'
import deleteIcon from './images/delete.png'
import pinIcon from './images/pin.png'
import editIcon from './images/edit.png'

interface IMessageInteractionProps {
  replyFunc: any
  pinFunc: any
  deleteFunc?: any
  editFunc?: any
  isPinned: boolean
}

export const MessageInteraction: React.FC<IMessageInteractionProps> = ({
  replyFunc,
  editFunc,
  deleteFunc,
  pinFunc,
  isPinned,
}) => {
  const isMyMessage = editFunc !== null && deleteFunc !== null

  if (isMyMessage) {
    return (
      <div className={cl.container}>
        <button onClick={replyFunc} className={cl.button}>
          <img
            draggable={false}
            className={cl.icon}
            src={replyIcon}
            alt="reply-icon"
          />
        </button>
        <button onClick={pinFunc} className={cl.button}>
          <img
            draggable={false}
            className={cl.icon}
            src={pinIcon}
            alt="pin-icon"
          />
        </button>
        <button onClick={editFunc} className={cl.button}>
          <img
            draggable={false}
            className={cl.icon}
            src={editIcon}
            alt="edit-icon"
          />
        </button>
        <button onClick={deleteFunc} className={cl.button}>
          <img
            draggable={false}
            className={cl.icon}
            src={deleteIcon}
            alt="delete-icon"
          />
        </button>
      </div>
    )
  }
  return <div className={cl.container}></div>
}
