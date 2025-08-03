import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMessage } from '../types/IMessage'

interface MessagesState {
  messagesByChatId: {
    [chatId: string]: IMessage[]
  }
}

const initialState: MessagesState = {
  messagesByChatId: {},
}

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessagesForChat: (state, action) => {
      const { chatId, messages } = action.payload
      state.messagesByChatId[chatId] = messages
    },
    addMessageToChat: (state, action) => {
      const { chatId, message } = action.payload
      if (state.messagesByChatId[chatId]) {
        state.messagesByChatId[chatId].push(message)
      } else {
        state.messagesByChatId[chatId] = [message]
      }
    },
    deleteMessageFromChat: (
      state,
      action: PayloadAction<{ chatId: string; messageId: string }>
    ) => {
      const { chatId, messageId } = action.payload
      if (state.messagesByChatId[chatId]) {
        state.messagesByChatId[chatId] = state.messagesByChatId[chatId].filter(
          (msg) => msg._id !== messageId
        )
      }
    },

    editMessageInChat: (
      state,
      action: PayloadAction<{
        chatId: string
        messageId: string
        newText: string
      }>
    ) => {
      const { chatId, messageId, newText } = action.payload
      const chatMessages = state.messagesByChatId[chatId]
      if (chatMessages) {
        const message = chatMessages.find((msg) => msg._id === messageId)
        if (message) {
          message.text = newText
        }
      }
    },
  },
})

export const {
  setMessagesForChat,
  addMessageToChat,
  deleteMessageFromChat,
  editMessageInChat,
} = messageSlice.actions
export default messageSlice.reducer
