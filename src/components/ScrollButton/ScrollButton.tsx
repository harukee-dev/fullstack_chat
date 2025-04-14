import { AnimatePresence, motion } from 'framer-motion'
import cl from './scrollButton.module.css'

interface IProps {
  isVisibleScrollButton: boolean
  handleClick: any
}

export const ScrollButton: React.FC<IProps> = ({
  isVisibleScrollButton,
  handleClick,
}) => {
  return (
    <AnimatePresence>
      {isVisibleScrollButton && (
        <motion.button
          onClick={handleClick}
          key="scroll-button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className={cl.button}
        >
          ↓
        </motion.button>
      )}
    </AnimatePresence>
  )
}
