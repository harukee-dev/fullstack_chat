import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Picker from '@emoji-mart/react'
import cl from './emojiPicker.module.css'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  isVisible: boolean
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelect,
  isVisible,
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const pickerWidth = windowWidth < 600 ? 300 : 400
  const emojisPerLine = windowWidth < 600 ? 6 : 9

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            clipPath: 'inset(10% 0% 0% 10%)',
            opacity: 0,
            scale: 0.95,
            transformOrigin: 'bottom right',
          }}
          animate={{
            clipPath: 'inset(0% 0% 0% 0%)',
            opacity: 1,
            scale: 1,
            transition: {
              duration: 0.15,
              ease: 'easeOut',
            },
          }}
          exit={{
            clipPath: 'inset(10% 0% 0% 10%)',
            opacity: 0,
            scale: 0.95,
            transition: {
              duration: 0.15,
              ease: 'easeIn',
            },
          }}
          style={{ width: pickerWidth }}
          className={cl.picker}
        >
          <Picker
            onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
            theme="dark"
            perLine={emojisPerLine}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
