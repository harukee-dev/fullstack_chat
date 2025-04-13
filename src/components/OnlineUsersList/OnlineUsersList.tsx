import React from 'react'
import cl from './onlineUsersList.module.css'

interface IProps {
  users: string[]
}

export const OnlineUsersList: React.FC<IProps> = ({ users }) => {
  return (
    <div className={cl.container}>
      {users.map((el, index) => (
        <p className={cl.user} key={index}>
          {el}
        </p>
      ))}
    </div>
  )
}
