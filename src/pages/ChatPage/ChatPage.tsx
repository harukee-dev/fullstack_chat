import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'
import cl from './ChatPage.module.css'

export const Chat = () => {
  return (
    <div className={cl.body}>
      <LeftWindow />
      <RightWindow />
    </div>
  )
}
