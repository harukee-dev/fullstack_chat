import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  token: string | null
}

const initialState: AuthState = {
  token: localStorage.getItem('token') || null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload
      localStorage.setItem('token', action.payload)
    },
    removeToken: (state) => {
      state.token = null
      localStorage.removeItem('token')
    },
  },
})

export const { setToken, removeToken } = authSlice.actions
export default authSlice.reducer
