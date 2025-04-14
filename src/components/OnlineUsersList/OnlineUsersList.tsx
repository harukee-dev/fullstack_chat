import React from 'react'
import cl from './onlineUsersList.module.css'
import { AnimatePresence, motion } from 'framer-motion'

interface IProps {
  isOpened: boolean
  users: string[]
}

export const OnlineUsersList: React.FC<IProps> = ({ isOpened, users }) => {
  return (
    <AnimatePresence>
      {isOpened && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className={cl.container}
        >
          {users.map((el, index) => (
            <p className={cl.user} key={index}>
              <div className={cl.onlineCircle} />
              {el}
            </p>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
