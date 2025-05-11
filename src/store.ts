import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import replyReducer from './slices/replyMessageSlice'
import searchReducer from './slices/searchMessageSlice'
import currentUserReducer from './slices/currentUserSlice'
import { TypedUseSelectorHook, useSelector } from 'react-redux'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    reply: replyReducer,
    search: searchReducer,
    currentUser: currentUserReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
