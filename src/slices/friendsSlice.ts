import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: any = {
  friends: [],
}

const friendsSlice = createSlice({
  name: 'friends',
  initialState,
  reducers: {
    setFriends: (state, action: PayloadAction<any>) => {
      state.friends = action.payload
    },
  },
})

export const { setFriends } = friendsSlice.actions
export default friendsSlice.reducer
