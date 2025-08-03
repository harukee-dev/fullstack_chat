import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: any = {
  isNotification: false,
  newMessage: null,
}

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setNotification: (state, action: PayloadAction<boolean>) => {
      state.isNotification = action.payload
    },
    setNewMessage: (state, action: PayloadAction<any>) => {
      state.newMessage = action.payload
    },
  },
})

export const { setNotification, setNewMessage } = notificationSlice.actions
export default notificationSlice.reducer
