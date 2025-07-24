import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: any = {
  chats: [],
}

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    addChat: (state, action: PayloadAction<any>) => {
      state.chats = [...state.chats, action.payload]
    },
    deleteChat: (state, action: PayloadAction<any>) => {
      state.chats = state.chats.filter((el: any) => el.id !== action.payload)
    },
  },
})

export const { addChat, deleteChat } = chatsSlice.actions
export default chatsSlice.reducer
