import cameraIcon from './images/nonactive-icons/camera-icon.png'
import streamIcon from './images/nonactive-icons/stream-icon.png'
import muteIcon from './images/nonactive-icons/mute-icon.png'
import disconnectIcon from './images/nonactive-icons/disconnect-icon.png'
import activeCameraIcon from './images/active-icons/camera-active-icon.png'
import activeStreamIcon from './images/active-icons/stream-active-icon.png'
import activeMuteIcon from './images/active-icons/unmute-icon.png'
import activeDisconnectIcon from './images/active-icons/disconnect-active-icon.png'
import React, { useState } from 'react'
import cl from './callInteraction.module.css'

interface ICallInteraction {
  setIsCamera: any
  isCamera: boolean
  toggleStream: any
  isStream: boolean
  setIsMuted: any
  isMuted: boolean
  leaveRoom: any
  canCaptureSystemAudio?: boolean
}

export const CallInteraction: React.FC<ICallInteraction> = ({
  setIsCamera,
  isCamera,
  setIsMuted,
  isMuted,
  toggleStream,
  isStream,
  leaveRoom,
  canCaptureSystemAudio = false,
}) => {
  const [isDisconnectHover, setIsDisconnectHover] = useState<boolean>(false)

  const handleMouseEnterDisconnect = () => {
    if (!isDisconnectHover) setIsDisconnectHover(true)
  }

  const handleMouseLeaveDisconnect = () => {
    if (isDisconnectHover) setIsDisconnectHover(false)
  }

  return (
    <div className={cl.interactionContainer}>
      <button
        onClick={() => setIsCamera((prev: any) => !prev)}
        className={isCamera ? cl.activeCameraButton : cl.button}
      >
        <img
          draggable={false}
          className={cl.icon}
          src={isCamera ? activeCameraIcon : cameraIcon}
          alt="camera"
        />
      </button>
      <button
        onClick={toggleStream}
        className={isStream ? cl.activeCameraButton : cl.button}
      >
        <img
          draggable={false}
          className={cl.icon}
          src={isStream ? activeStreamIcon : streamIcon}
          alt="stream
        "
        />
      </button>
      <button
        onClick={() => setIsMuted((prev: any) => !prev)}
        className={isMuted ? cl.activeMutedButton : cl.button}
      >
        <img
          draggable={false}
          className={cl.icon}
          src={isMuted ? activeMuteIcon : muteIcon}
          alt="mute"
        />
      </button>
      <button
        onClick={leaveRoom}
        onMouseEnter={handleMouseEnterDisconnect}
        onMouseLeave={handleMouseLeaveDisconnect}
        className={cl.disconnectButton}
      >
        <img
          draggable={false}
          className={cl.icon}
          src={isDisconnectHover ? activeDisconnectIcon : disconnectIcon}
          alt="disconnect"
        />
      </button>
    </div>
  )
}
