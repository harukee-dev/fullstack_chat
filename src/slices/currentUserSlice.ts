import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: any = {
  user: null,
}

const currentUserSlice = createSlice({
  name: 'currentUser',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<any>) => {
      console.log('SET CURRENT USER')
      state.user = action.payload
    },
  },
})

export const { setUser } = currentUserSlice.actions
export default currentUserSlice.reducer
