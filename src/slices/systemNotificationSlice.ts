import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface IState {
  isSystemNotification: boolean
  text: string | null
}

const initialState: IState = {
  isSystemNotification: false,
  text: null,
}

const systemNotificationSlice = createSlice({
  name: 'systemNotification',
  initialState,
  reducers: {
    setSystemNotification: (state, action: PayloadAction<boolean>) => {
      state.isSystemNotification = action.payload
    },
    setSystemNotificationText: (state, action: PayloadAction<string>) => {
      state.text = action.payload
    },
  },
})

export const { setSystemNotification, setSystemNotificationText } =
  systemNotificationSlice.actions
export default systemNotificationSlice.reducer
