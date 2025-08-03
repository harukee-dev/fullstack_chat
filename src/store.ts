import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import replyReducer from './slices/replyMessageSlice'
import searchReducer from './slices/searchMessageSlice'
import currentUserReducer from './slices/currentUserSlice'
import friendsReducer from './slices/friendsSlice'
import { TypedUseSelectorHook, useSelector } from 'react-redux'
import chatsReducer from './slices/chatSlice'
import notificationReducer from './slices/notificationSlice'
import messagesReducer from './slices/chatMessages'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    reply: replyReducer,
    search: searchReducer,
    currentUser: currentUserReducer,
    friends: friendsReducer,
    chats: chatsReducer,
    notification: notificationReducer,
    messagesByChatId: messagesReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
