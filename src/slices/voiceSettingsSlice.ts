import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Типы
interface VoiceSettingsState {
  threshold: number
  noise: boolean
  echo: boolean
  autoGain: boolean
}

// Вспомогательные функции для работы с localStorage
const getStoredNumber = (key: string, defaultValue: number): number => {
  const stored = localStorage.getItem(key)
  return stored ? Number(stored) : defaultValue
}

const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  const stored = localStorage.getItem(key)
  return stored ? stored === 'true' : defaultValue
}

// Начальное состояние
const initialState: VoiceSettingsState = {
  threshold: getStoredNumber('threshold', -40),
  noise: getStoredBoolean('noise', true),
  echo: getStoredBoolean('echo', true),
  autoGain: getStoredBoolean('auto-gain', true),
}

const voiceSettingsSlice = createSlice({
  name: 'voiceSettings',
  initialState,
  reducers: {
    setThreshold: (state, action: PayloadAction<number>) => {
      state.threshold = action.payload
      localStorage.setItem('threshold', action.payload.toString())
    },
    setNoise: (state, action: PayloadAction<boolean>) => {
      state.noise = action.payload
      localStorage.setItem('noise', action.payload.toString())
    },
    setEcho: (state, action: PayloadAction<boolean>) => {
      state.echo = action.payload
      localStorage.setItem('echo', action.payload.toString())
    },
    setAutoGain: (state, action: PayloadAction<boolean>) => {
      state.autoGain = action.payload
      localStorage.setItem('auto-gain', action.payload.toString())
    },
    toggleNoise: (state) => {
      state.noise = !state.noise
      localStorage.setItem('noise', state.noise.toString())
    },
    toggleEcho: (state) => {
      state.echo = !state.echo
      localStorage.setItem('echo', state.echo.toString())
    },
    toggleAutoGain: (state) => {
      state.autoGain = !state.autoGain
      localStorage.setItem('auto-gain', state.autoGain.toString())
    },
  },
})

export const {
  setThreshold,
  setAutoGain,
  setEcho,
  setNoise,
  toggleNoise,
  toggleEcho,
  toggleAutoGain,
} = voiceSettingsSlice.actions

export default voiceSettingsSlice.reducer
