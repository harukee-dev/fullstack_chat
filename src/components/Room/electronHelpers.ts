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

export const checkWindowAudioSupport = async (): Promise<boolean> => {
  if (!isElectron()) return false

  try {
    const platform = window.electronAPI?.platform || process.platform
    if (platform !== 'win32') return false

    // Проверяем поддержку через Electron API
    //@ts-ignore
    const supported = await window.electronAPI.checkWindowAudioSupport()
    return supported
  } catch (error) {
    console.error('Error checking window audio support:', error)
    return false
  }
}

export const getWindowAudioInfo = async (
  sourceId: string
): Promise<{ hasAudio: boolean }> => {
  if (!isElectron()) return { hasAudio: false }

  try {
    //@ts-ignore
    return await window.electronAPI.getWindowAudioInfo(sourceId)
  } catch (error) {
    console.error('Error getting window audio info:', error)
    return { hasAudio: false }
  }
}
