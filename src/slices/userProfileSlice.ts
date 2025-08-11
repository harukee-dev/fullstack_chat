import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMessage } from '../types/IMessage'

interface userProfileState {
  isOpened: boolean
  username: string
  description: string
  avatar: string
  isOnline: boolean
  userId: string
  banner: string
}

const initialState: userProfileState = {
  isOpened: false,
  username: '',
  description: '',
  avatar: '',
  isOnline: false,
  userId: '',
  banner: '',
}

interface PayloadObject {
  username: string
  description: string
  avatar: string
  isOnline: boolean
  userId: string
  banner: string
}

const userProfileModalSlice = createSlice({
  name: 'userProfileModal',
  initialState,
  reducers: {
    setIsOpened: (state, action: PayloadAction<boolean>) => {
      state.isOpened = action.payload
    },
    setUserModalData: (state, action: PayloadAction<PayloadObject>) => {
      const { username, description, avatar, isOnline, userId, banner } =
        action.payload
      state.username = username
      state.description = description
      state.avatar = avatar
      state.isOnline = isOnline
      state.userId = userId
      state.banner = banner
    },
  },
})

export const { setIsOpened, setUserModalData } = userProfileModalSlice.actions
export default userProfileModalSlice.reducer
