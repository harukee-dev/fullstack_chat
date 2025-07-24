export interface IUser {
  _id: string
  username: string
  avatar?: string
}

export interface IMessage {
  _id: string
  text: string
  timestamp?: Date | string
  senderId: IUser
  replyMessage?: { username: string; text: string }
  isPinned?: boolean
  chatId: string
}
