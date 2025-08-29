import { motion } from 'framer-motion'
import icon from './images/database-icon.png'
import cl from './systemNotification.module.css'
import { FC } from 'react'

interface ISystemNotification {
  text: string | null
}

export const SystemNotification: FC<ISystemNotification> = ({ text }) => {
  return (
    <motion.div
      initial={{ y: 35, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -35, opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={cl.container}
    >
      <p className={cl.text}>{text}</p>
      <img className={cl.icon} src={icon} alt="database-icon" />
    </motion.div>
  )
}
