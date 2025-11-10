// electronHelpers.ts
export const isElectron = (): boolean => {
  return !!(window as any).electronAPI
}

export const canCaptureSystemAudio = (): boolean => {
  if (!isElectron()) return false

  try {
    // Вызываем как функцию, так как в preload.js это функция
    return (window as any).electronAPI.canCaptureSystemAudio?.() || false
  } catch (error) {
    console.error('Error checking system audio support:', error)
    return false
  }
}

export const checkSystemAudioSupport = async (): Promise<boolean> => {
  if (!isElectron()) return false

  try {
    const supported = canCaptureSystemAudio()
    console.log('🔊 System audio capture supported:', supported)
    return supported
  } catch (error) {
    console.error('Error checking system audio support:', error)
    return false
  }
}

export const checkScreenShareSupport = async (): Promise<boolean> => {
  if (!isElectron()) return false

  try {
    const hasAccess = await (
      window as any
    ).electronAPI.checkScreenCaptureAccess?.()
    console.log('🖥️ Screen capture access:', hasAccess)
    return hasAccess !== false
  } catch (error) {
    console.error('Error checking screen share support in Electron:', error)
    return false
  }
}
