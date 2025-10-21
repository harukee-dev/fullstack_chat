import { AppDispatch, useAppSelector } from '../../store'
import cl from './modalVoiceSettings.module.css'
import {
  setThreshold,
  setNoise,
  setEcho,
  setAutoGain,
  toggleEcho,
  toggleNoise,
  toggleAutoGain,
} from '../../slices/voiceSettingsSlice'
import { useDispatch } from 'react-redux'

export const ModalVoiceSettings = () => {
  const { echo, noise, threshold, autoGain } = useAppSelector(
    (state) => state.voiceSettings
  )
  const dispatch = useDispatch<AppDispatch>()

  const handleToggleNoise = () => dispatch(toggleNoise())
  const handleToggleEcho = () => dispatch(toggleEcho())
  const handleToggleAutoGain = () => dispatch(toggleAutoGain())

  const handleThresholdChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = Number(event.target.value)
    dispatch(setThreshold(value))
  }

  return (
    <div className={cl.allContainer}>
      <div className={cl.settingContainer}>
        <p className={cl.settingText}>Шумоподавление</p>
        <button className={cl.button} onClick={handleToggleNoise}>
          {noise ? 'вкл' : 'выкл'}
        </button>
      </div>
      <div className={cl.settingContainer}>
        <p className={cl.settingText}>Эхоподавление</p>
        <button className={cl.button} onClick={handleToggleEcho}>
          {echo ? 'вкл' : 'выкл'}
        </button>
      </div>
      <div className={cl.settingContainer}>
        <p className={cl.settingText}>Автоусиление</p>
        <button className={cl.button} onClick={handleToggleAutoGain}>
          {autoGain ? 'вкл' : 'выкл'}
        </button>
      </div>
      <div>
        <p>Чувствительность ввода</p>
        <input
          type="range"
          min={-100}
          max={0}
          value={threshold}
          onChange={(event) => handleThresholdChange(event)}
        />
      </div>
    </div>
  )
}
