import cl from './messageInteraction.module.css'

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
          Reply
        </button>
        <button onClick={pinFunc} className={cl.button}>
          {isPinned ? 'Unpin' : 'Pin'}
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
        {isPinned ? 'Unpin' : 'Pin'}
      </button>
    </div>
  )
}
