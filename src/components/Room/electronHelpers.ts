export const isElectron = (): boolean => {
  return !!(window.electronAPI || (window as any).process?.type)
}

export const canCaptureSystemAudio = (): boolean => {
  return isElectron() && window.electronAPI?.platform !== 'linux' // Linux может иметь ограничения
}
