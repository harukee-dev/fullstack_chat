import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMessage } from '../types/IMessage'

interface ReplyState {
  message: IMessage | null
}

const initialState: ReplyState = {
  message: null,
}

const replySlice = createSlice({
  name: 'reply',
  initialState,
  reducers: {
    setReplyMessage: (state, action: PayloadAction<IMessage>) => {
      state.message = action.payload
      localStorage.setItem('replyMessage', action.payload.text)
    },
    removeReplyMessage: (state) => {
      state.message = null
      localStorage.removeItem('replyMessage')
    },
  },
})

export const { setReplyMessage, removeReplyMessage } = replySlice.actions
export default replySlice.reducer
