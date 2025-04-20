import cl from './messageInteraction.module.css'

interface IMessageInteractionProps {
  replyFunc: any
  pinFunc: any
  deleteFunc?: any
  editFunc?: any
}

export const MessageInteraction: React.FC<IMessageInteractionProps> = ({
  replyFunc,
  editFunc,
  deleteFunc,
  pinFunc,
}) => {
  const isMyMessage = editFunc !== null && deleteFunc !== null

  if (isMyMessage) {
    return (
      <div className={cl.container}>
        <button onClick={replyFunc} className={cl.button}>
          Reply
        </button>
        <button onClick={pinFunc} className={cl.button}>
          Pin
        </button>
        <button onClick={editFunc} className={cl.button}>
          Edit
        </button>
        <button onClick={deleteFunc} className={cl.button}>
          Delete
        </button>
      </div>
    )
  }
  return (
    <div className={cl.container}>
      <button onClick={replyFunc} className={cl.button}>
        Reply
      </button>
      <button onClick={pinFunc} className={cl.button}>
        Pin
      </button>
    </div>
  )
}
