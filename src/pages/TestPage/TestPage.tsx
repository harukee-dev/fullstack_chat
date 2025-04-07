import { ChatComponent } from '../../components/Chat/Chat'

export const TestPage = () => {
  return (
    <div>
      <ChatComponent
        messages={[{ username: 'harukee', text: 'hello' }]}
        isClear={true}
      />
    </div>
  )
}
