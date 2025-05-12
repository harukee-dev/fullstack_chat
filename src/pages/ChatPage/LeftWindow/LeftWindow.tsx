import { ChatsList } from '../../../components/ChatsList/ChatsList'
import cl from './leftWindow.module.css'
import settings from './images/settings-icon.png'
import { TIP_URL } from '../../../constants'
import moneyIconGray from './images/money-gray.svg'
import moneyIconPurple from './images/money-purple.svg'
import friendsIconGray from './images/friends-gray.svg'
import friendsIconPurple from './images/friends-purple.svg'
import fluxIconGray from './images/flux-gray.svg'
import fluxIconPurple from './images/flux-purple.svg'
import { useEffect, useState } from 'react'
import micIcon from './images/mic-icon.svg'
import headphonesIcon from './images/headphones-icon.svg'
import settingsIcon from './images/settings-icon.svg'

export const LeftWindow = () => {
  const [moneyHover, setMoneyHover] = useState(false)
  const [friendsHover, setFriendsHover] = useState(false)
  const [fluxHover, setFluxHover] = useState(false)

  useEffect(() => {
    const purpleFriends = new Image()
    purpleFriends.src = friendsIconPurple

    const purpleMoney = new Image()
    purpleMoney.src = moneyIconPurple

    const purpleFlux = new Image()
    purpleFlux.src = fluxIconPurple
  }, [])

  const users = [
    {
      username: 'general chat',
      avatar:
        'https://i.pinimg.com/originals/41/b2/cc/41b2cc482076e1f988453413a93b07bd.gif',
      isOnline: true,
      navigate: '/main/chat',
    },
  ]
  return (
    <div className={cl.leftContainer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3vh' }}>
        <div className={cl.buttonsContainer}>
          <button
            onMouseEnter={() => setMoneyHover(true)}
            onMouseLeave={() => setMoneyHover(false)}
            onClick={() => window.open(TIP_URL, '_blank')}
            className={cl.boostyButton}
          >
            {(moneyHover && (
              <img className={cl.icon} src={moneyIconPurple} alt="money-gray" />
            )) || (
              <img className={cl.icon} src={moneyIconGray} alt="money-gray" />
            )}
            Support the project with a tip
          </button>
          <button
            onMouseEnter={() => setFriendsHover(true)}
            onMouseLeave={() => setFriendsHover(false)}
            className={cl.friendsButton}
          >
            {(friendsHover && (
              <img
                className={cl.icon}
                src={friendsIconPurple}
                alt="money-gray"
              />
            )) || (
              <img className={cl.icon} src={friendsIconGray} alt="money-gray" />
            )}
            Friends
          </button>
          <button
            onMouseEnter={() => setFluxHover(true)}
            onMouseLeave={() => setFluxHover(false)}
            className={cl.settingsButton}
          >
            {(fluxHover && (
              <img className={cl.icon} src={fluxIconPurple} alt="money-gray" />
            )) || (
              <img className={cl.icon} src={fluxIconGray} alt="money-gray" />
            )}
            Flux
          </button>
        </div>
        <div className={cl.hr}></div>

        <ChatsList users={users} />

        <div className={cl.voiceSettingsContainer}>
          <div style={{ display: 'flex', gap: '.7vw', alignItems: 'center' }}>
            <img
              className={cl.yourAvatar}
              src="https://i.pinimg.com/736x/41/71/2a/41712a627fcf3482a12c69659ec7abd6.jpg"
              alt="avatar"
            />
            <div className={cl.usernameAndStatus}>
              <p className={cl.subUsername}>harukee</p>
              <p className={cl.subStatus}>Online</p>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '.5vw',
              marginRight: '2.15vw',
            }}
          >
            <img
              className={cl.settingsIcon}
              src={micIcon}
              alt="microphone-icon"
            />
            <img
              className={cl.settingsIcon}
              src={headphonesIcon}
              alt="headphones-icon"
            />
            <img
              className={cl.settingsIcon}
              src={settingsIcon}
              alt="settings-icon"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
