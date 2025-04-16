import cl from './dateSeparator.module.css'

interface IProps {
  date: string
}

export const DateSeparator: React.FC<IProps> = ({ date }) => {
  return <span className={cl.separator}>{date}</span>
}
