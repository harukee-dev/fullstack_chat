interface IUser {
  username: string
  avatar: string | null
  isOnline: boolean
  navigate: string
}

export interface ChatsListProps {
  users: IUser[]
}
