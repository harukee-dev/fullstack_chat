import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: any = {
  friends: [],
  onlineFriends: [],
}

const friendsSlice = createSlice({
  name: 'friends',
  initialState,
  reducers: {
    setFriends: (state, action: PayloadAction<any>) => {
      state.friends = action.payload
    },
    setOnlineFriends: (state, action: PayloadAction<any>) => {
      state.onlineFriends = action.payload
    },
    addOnlineFriend: (state, action: PayloadAction<any>) => {
      state.onlineFriends.push(action.payload)
    },
  },
})

export const { setFriends, setOnlineFriends, addOnlineFriend } =
  friendsSlice.actions
export default friendsSlice.reducer
