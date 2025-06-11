import { motion } from 'framer-motion'
import cl from './dateSeparator.module.css'

interface IProps {
  date: string
}

export const DateSeparator: React.FC<IProps> = ({ date }) => {
  // return <span className={cl.separator}>{date}</span>
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <span className={cl.separator}>{date}</span>
    </motion.div>
  )
}
