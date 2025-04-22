interface IUser {
  username: string
  avatar: string | null
  isOnline: boolean
}

export interface ChatsListProps {
  users: IUser[]
}
