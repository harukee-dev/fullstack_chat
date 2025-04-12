import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'

export const Chat = () => {
  return (
    <div style={{ display: 'flex', gap: '1.5vh' }}>
      <LeftWindow />
      <RightWindow />
    </div>
  )
}
