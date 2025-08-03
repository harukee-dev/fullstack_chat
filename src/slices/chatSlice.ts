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
    sortChats: (state) => {
      state.chats = [...state.chats].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    },
    updateChat(
      state,
      action: PayloadAction<{ id: string; updatedAt: string }>
    ) {
      const { id, updatedAt } = action.payload
      const chat = state.chats.find(
        (c: any) => c._id.toString() === id.toString()
      )
      if (chat) {
        chat.updatedAt = updatedAt
      }
      state.chats.sort(
        (a: any, b: any) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    },
  },
})

export const { addChat, deleteChat, setChats, sortChats, updateChat } =
  chatsSlice.actions
export default chatsSlice.reducer
