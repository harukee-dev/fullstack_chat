import cl from './friendModal.module.css'

export const FriendModal = () => {
  return (
    <div className={cl.firstContainer}>
      <div className={cl.mainContainer}>
        <img
          className={cl.banner}
          src="https://i.pinimg.com/736x/8d/05/04/8d0504e9a3276b148f288bcb0d4bfc08.jpg"
          alt="BANNER"
        />
        <div className={cl.avatarAndInfoContainer}>
          <img
            className={cl.avatar}
            src="https://i.pinimg.com/1200x/f8/fe/e7/f8fee7ad0731756966523974d526620b.jpg"
            alt="AVATAR"
          />
          <div className={cl.infoAndButtonsContainer}>
            <div className={cl.nicknameAndStatusContainer}>
              <p className={cl.nickname}>jerue</p>
              <div className={cl.indicatorAndStatusContainer}>
                <div className={cl.onlineIndicator} />
                <p className={cl.onlineStatus}>Online</p>
              </div>
            </div>
            <div className={cl.buttonsContainer}>
              <button className={cl.button}>Message</button>
              <button className={cl.button}>Call</button>
              <button className={cl.deleteButton}>Remove friend</button>
            </div>
          </div>
        </div>
        <div className={cl.userDescriptionContainer}>
          <p className={cl.userDescriptionTitle}>About me:</p>
          <p className={cl.userDescriptionSubtitle}>
            hi! my name is jerue. i like playing fortnite and fucking all my
            enemies on morphling in dota 2, but second thing is harder than i
            always thought
          </p>
        </div>
      </div>
    </div>
  )
}
