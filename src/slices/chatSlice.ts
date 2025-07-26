import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: any = {
  chats: [],
}

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    addChat: (state, action: PayloadAction<any>) => {
      state.chats = [action.payload, ...state.chats]
    },
    deleteChat: (state, action: PayloadAction<any>) => {
      state.chats = state.chats.filter((el: any) => el.id !== action.payload)
    },
    setChats: (state, action: PayloadAction<any>) => {
      state.chats = action.payload
    },
  },
})

export const { addChat, deleteChat, setChats } = chatsSlice.actions
export default chatsSlice.reducer
