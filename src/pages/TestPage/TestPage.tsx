import { ChatComponent } from '../../components/Chat/Chat'
import { Message } from '../../components/Message/Message'

export const TestPage = () => {
  return (
    <div>
      <ChatComponent
        messages={[{ name: 'harukee', message: 'hello' }]}
        isClear={true}
      />
    </div>
  )
}
