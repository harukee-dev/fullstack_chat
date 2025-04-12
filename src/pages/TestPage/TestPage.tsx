import { ChatsList } from '../../components/ChatsList/ChatsList'
import { ChatTab } from '../../components/ChatTab/ChatTab'
import { LeftWindow } from '../ChatPage/LeftWindow/LeftWindow'
import { RightWindow } from '../ChatPage/RightWindow/RightWindow'

export const TestPage = () => {
  return (
    <div style={{ display: 'flex', gap: '1.5vh' }}>
      <LeftWindow />
      <RightWindow />
    </div>
  )
}
