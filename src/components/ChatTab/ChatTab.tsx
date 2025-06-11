import React, { useState } from 'react'
import { ChatTabProps } from './typesChatTab'
import cl from './ChatTab.module.css'
import closeIcon from './images/close-chat.svg'
import { useNavigate } from 'react-router-dom'

export const ChatTab: React.FC<ChatTabProps> = ({
  username,
  avatar,
  isOnline,
  navigate,
}) => {
  const [onlineStatus, setOnlineStatus] = useState<string>(
    isOnline ? 'Online' : 'Offline'
  )
  const navigateFunc = useNavigate()
  return (
    // <div className={cl.container}>
    //   {avatar ? (
    //     <img className={cl.avatar} src={avatar} alt="avatar" />
    //   ) : (
    //     <div className={cl.defaultAvatar}>
    //       <p className={cl.defaultAvatarText}>
    //         {username.charAt(0).toUpperCase()}
    //       </p>
    //     </div>
    //   )}
    //   <div>
    //     <p className={cl.username}>{username}</p>
    //     {isOnline ? (
    //       <p className={cl.statusOnline}>{onlineStatus}</p>
    //     ) : (
    //       <p className={cl.statusOffline}>{onlineStatus}</p>
    //     )}
    //   </div>
    // </div>

    <div onClick={() => navigateFunc(navigate)} className={cl.container}>
      <div>
        {avatar ? (
          <img
            draggable={false}
            className={isOnline ? cl.avatarOnline : cl.avatarOffline}
            src={avatar}
            alt="avatar"
          />
        ) : (
          <div className={cl.defaultAvatar}>
            <p className={cl.defaultAvatarText}>
              {username.charAt(0).toUpperCase()}
            </p>
          </div>
        )}
      </div>
      <p className={cl.username}>{username}</p>
      <img
        draggable={false}
        className={cl.closeIcon}
        src={closeIcon}
        alt="close-icon"
      />
    </div>
  )
}
