import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMessage } from '../types/IMessage'

interface SearchState {
  value: string
}

const initialState: SearchState = {
  value: '',
}

const SearchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setValue: (state, action: PayloadAction<string>) => {
      state.value = action.payload
    },
  },
})

export const { setValue } = SearchSlice.actions
export default SearchSlice.reducer
