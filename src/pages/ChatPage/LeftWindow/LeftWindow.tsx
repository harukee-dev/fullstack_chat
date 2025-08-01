import { ChatsList } from '../../../components/ChatsList/ChatsList'
import cl from './leftWindow.module.css'
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
import { useNavigate } from 'react-router-dom'

export const LeftWindow = () => {
  const [moneyHover, setMoneyHover] = useState(false)
  const [friendsHover, setFriendsHover] = useState(false)
  const [fluxHover, setFluxHover] = useState(false)
  const currentUsername = localStorage.getItem('username')
  const currentUserAvatar = localStorage.getItem('avatar')

  const navigate = useNavigate()

  useEffect(() => {
    const purpleFriends = new Image()
    purpleFriends.src = friendsIconPurple

    const purpleMoney = new Image()
    purpleMoney.src = moneyIconPurple

    const purpleFlux = new Image()
    purpleFlux.src = fluxIconPurple
  }, [])

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
              <img
                draggable={false}
                className={cl.icon}
                src={moneyIconPurple}
                alt="money-gray"
              />
            )) || (
              <img
                draggable={false}
                className={cl.icon}
                src={moneyIconGray}
                alt="money-gray"
              />
            )}
            Support the project with a tip
          </button>
          <button
            onMouseEnter={() => setFriendsHover(true)}
            onMouseLeave={() => setFriendsHover(false)}
            className={cl.friendsButton}
            onClick={() => navigate('/main/friends/list')}
          >
            {(friendsHover && (
              <img
                draggable={false}
                className={cl.icon}
                src={friendsIconPurple}
                alt="money-gray"
              />
            )) || (
              <img
                draggable={false}
                className={cl.icon}
                src={friendsIconGray}
                alt="money-gray"
              />
            )}
            Friends
          </button>
          <button
            onMouseEnter={() => setFluxHover(true)}
            onMouseLeave={() => setFluxHover(false)}
            className={cl.settingsButton}
          >
            {(fluxHover && (
              <img
                draggable={false}
                className={cl.icon}
                src={fluxIconPurple}
                alt="money-gray"
              />
            )) || (
              <img
                draggable={false}
                className={cl.icon}
                src={fluxIconGray}
                alt="money-gray"
              />
            )}
            Flux
          </button>
        </div>
        <div className={cl.hr}></div>

        <ChatsList />

        <div className={cl.voiceSettingsContainer}>
          <div style={{ display: 'flex', gap: '.7vw', alignItems: 'center' }}>
            <img
              draggable={false}
              className={cl.yourAvatar}
              src={
                currentUserAvatar ||
                'https://i.pinimg.com/736x/41/71/2a/41712a627fcf3482a12c69659ec7abd6.jpg'
              }
              alt="avatar"
            />
            <div className={cl.usernameAndStatus}>
              <p className={cl.subUsername}>{currentUsername}</p>
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
              draggable={false}
              className={cl.settingsIcon}
              src={micIcon}
              alt="microphone-icon"
            />
            <img
              draggable={false}
              className={cl.settingsIcon}
              src={headphonesIcon}
              alt="headphones-icon"
            />
            <img
              draggable={false}
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
