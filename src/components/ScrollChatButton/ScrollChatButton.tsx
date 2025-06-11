import cl from './scrollChatButton.module.css'
import buttonIcon from './images/scroll-chat.svg'
import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'

interface IScrollChatButtonProps {
  onClick: any
  isVisible: boolean
}

export const ScrollChatButton: React.FC<IScrollChatButtonProps> = ({
  onClick,
  isVisible,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          key="scroll-button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClick}
          className={cl.button}
        >
          <img draggable={false} src={buttonIcon} alt="scroll-icon" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
