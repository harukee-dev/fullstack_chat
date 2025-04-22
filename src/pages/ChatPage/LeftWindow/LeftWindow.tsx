import { ChatsList } from '../../../components/ChatsList/ChatsList'
import cl from './leftWindow.module.css'
import settings from './images/settings-icon.png'
import { BOOSTY_URL } from '../../../constants'

export const LeftWindow = () => {
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
            onClick={() => window.open(BOOSTY_URL, '_blank')}
            className={cl.boostyButton}
          >
            Subscribe harukee boosty
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
            <button className={cl.settingsButton}>
              <img style={{ width: '2vw' }} src={settings} alt="settings" />
            </button>
            <button className={cl.friendsButton}>Friends</button>
          </div>
        </div>
        <div className={cl.hr}></div>

        <ChatsList users={users} />
      </div>
    </div>
  )
}
