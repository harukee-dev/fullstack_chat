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
    pinMessageInChat: (state, action) => {
      const { chatId, messageId } = action.payload
      const messages = state.messagesByChatId[chatId]

      if (messages) {
        const msgIndex = messages.findIndex((msg) => msg._id === messageId)
        if (msgIndex !== -1) {
          messages[msgIndex].isPinned = true
        }
      }
    },
    unpinMessageInChat: (state, action) => {
      const { chatId, messageId } = action.payload
      const messages = state.messagesByChatId[chatId]

      if (messages) {
        const msgIndex = messages.findIndex((msg) => msg._id === messageId)
        if (msgIndex !== -1) {
          messages[msgIndex].isPinned = false
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
  pinMessageInChat,
  unpinMessageInChat,
} = messageSlice.actions
export default messageSlice.reducer
