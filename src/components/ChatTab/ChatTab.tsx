import React, { useState } from 'react'
import { ChatTabProps } from './typesChatTab'
import cl from './ChatTab.module.css'

export const ChatTab: React.FC<ChatTabProps> = ({
  username,
  avatar,
  isOnline,
}) => {
  const [onlineStatus, setOnlineStatus] = useState<string>(
    isOnline ? 'Online' : 'Offline'
  )
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

    <div className={cl.container}>
      <div>
        {avatar ? (
          <img className={cl.avatar} src={avatar} alt="avatar" />
        ) : (
          <div className={cl.defaultAvatar}>
            <p className={cl.defaultAvatarText}>
              {username.charAt(0).toUpperCase()}
            </p>
          </div>
        )}
        {isOnline ? (
          <div className={cl.onlineStatus} />
        ) : (
          <div className={cl.offlineStatus} />
        )}
      </div>
      <p className={cl.username}>{username}</p>
    </div>
  )
}
