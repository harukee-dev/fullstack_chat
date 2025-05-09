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
import { useState } from 'react'
import micIcon from './images/mic-icon.svg'
import headphonesIcon from './images/headphones-icon.svg'
import settingsIcon from './images/settings-icon.svg'

export const LeftWindow = () => {
  const [moneyHover, setMoneyHover] = useState(false)
  const [friendsHover, setFriendsHover] = useState(false)
  const [fluxHover, setFluxHover] = useState(false)

  const users = [
    {
      username: 'harukee',
      avatar:
        'https://i.pinimg.com/736x/86/cd/4d/86cd4d0117de1304028a08fa0bfdd2cf.jpg',
      isOnline: false,
    },
    {
      username: 'jerue',
      avatar:
        'https://i.pinimg.com/736x/f9/f4/82/f9f4829ec9f56b3883acf4d104431766.jpg',
      isOnline: true,
    },
    {
      username: 'htabos prime era les fukin go ma sssssssssssssss',
      avatar:
        'https://i.pinimg.com/736x/a0/a2/9d/a0a29d22137558a897215f40f88b403e.jpg',
      isOnline: true,
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
