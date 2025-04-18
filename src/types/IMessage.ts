export interface IMessage {
  username: string
  text: string
  timestamp?: Date | string
  _id: string
  replyMessage?: { username: string; text: string }
}
