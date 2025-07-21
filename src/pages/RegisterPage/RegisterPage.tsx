import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cl from './RegisterPage.module.css'
import { API_URL } from '../../constants'
import background from '../LoginPage/images/background.png'
import arrowIcon from '../LoginPage/images/arrow-icon.png'
import { setToken } from '../../slices/authSlice'
import { setUser } from '../../slices/currentUserSlice'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'

export const Register = () => {
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isVisiblePassword, setIsVisiblePassword] = useState<boolean>(false)
  const [step, setStep] = useState<'info' | 'avatar'>('info')
  const [avatar, setAvatar] = useState<string>(
    'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png'
  )
  const navigate = useNavigate()
  const isButtonHidden =
    password !== '' && login !== '' && password === confirmPassword

  const getPasswordStrength = (password: string) => {
    let strength: number = 0
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const getPasswordDifficulty = (strength: number) => {
    switch (strength) {
      case 0:
        return ''
      case 1:
        return 'easy'
      case 2:
        return 'easy'
      case 3:
        return 'normal'
      case 4:
        return 'hard'
      default:
        return ''
    }
  }

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.height = '100vh'

    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [])

  const dispatch = useDispatch<AppDispatch>()

  async function handleRegister() {
    const regex = /[a-zA-Zа-яА-ЯёЁ]/
    if (regex.test(login)) {
      try {
        const response = await fetch(API_URL + '/auth/registration', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: login, password, avatar }),
        })

        if (response.ok) {
          // HEREREREREREREERER
          // HEREREREREREREERER
          // HEREREREREREREERER
          // HEREREREREREREERER
          try {
            const response = await fetch(API_URL + '/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: login, password }),
            })

            const data = await response.json()

            if (response.ok) {
              localStorage.setItem('token', data.token)
              dispatch(setUser(data.user))
              dispatch(setToken(data.token))

              localStorage.removeItem('user-id')
              localStorage.removeItem('username')
              localStorage.removeItem('avatar')
              localStorage.setItem('user-id', data.user._id)
              localStorage.setItem('username', data.user.username)
              localStorage.setItem('avatar', data.user.avatar)

              navigate('/main')
            } else {
              console.error('Ошибка:', data.message)
              setError(data.message)
            }
          } catch (error) {
            console.error('Ошибка запроса:', error)
          }
        } else {
          const data = await response.json()
          console.error(data.message)
          setError(data.message)
        }
      } catch (error) {
        console.error(error)
      }
    } else {
      setError('Логин должен содержать буквы')
    }
  }

  const saveRegisterData = () => {
    localStorage.setItem('register-username', login)
    localStorage.setItem('register-password', password)
    setStep('avatar')
  }

  const strength = getPasswordStrength(password)
  const difficulty = getPasswordDifficulty(strength)

  return (
    <div className={cl.allPage}>
      {step === 'info' ? (
        <div className={cl.leftContainer}>
          <div>
            <h1 className={cl.welcomeText}>Welcome.</h1>
            <Link className={cl.register} to={'/login'}>
              Already have account? Sign in
            </Link>
          </div>
          <input
            className={cl.userInput}
            type="text"
            placeholder="login"
            onBlur={(e) => setLogin(e.target.value)}
          />
          <div className={cl.passwordContainer}>
            <input
              className={cl.passwordInput}
              type={isVisiblePassword ? 'text' : 'password'}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
            />
            <p
              className={
                difficulty === 'easy'
                  ? cl.easy
                  : difficulty === 'normal'
                  ? cl.normal
                  : cl.hard
              }
            >
              {difficulty}
            </p>
          </div>
          <div className={cl.passwordAndButtonDiv}>
            <input
              className={cl.userInput}
              type={isVisiblePassword ? 'text' : 'password'}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="confirm password"
            />
            {/* <button
            className={isButtonHidden ? cl.loginButton : cl.hiddenLoginButton}
            onClick={handleRegister}
          >
            <img
              draggable={false}
              className={isButtonHidden ? cl.arrowIcon : cl.hiddenArrowIcon}
              src={arrowIcon}
              alt="arrow-icon"
            />
          </button> */}
          </div>
          <div className={cl.visibilityContainer}>
            {/* <input
            className={cl.visibilityCheckbox}
            type="checkbox"
            onClick={() => setIsVisiblePassword((v) => !v)}
          /> */}
            <div
              className={isVisiblePassword ? cl.checkboxChecked : cl.checkbox}
              onClick={() => setIsVisiblePassword((v) => !v)}
            />
            <p className={cl.visibilityText}>show password</p>
          </div>
          {error && <p className={cl.error}>{error}</p>}
          <button
            disabled={!isButtonHidden}
            onClick={saveRegisterData}
            className={cl.continueButton}
          >
            Continue
          </button>
        </div>
      ) : (
        <div className={cl.leftContainerAvatar}>
          <h1 className={cl.welcomeTextAvatar}>Set your avatar</h1>
          <img className={cl.userAvatar} src={avatar} alt="user-avatar" />
          <input
            className={cl.userInputAvatar}
            type="text"
            placeholder="Enter image url"
            onBlur={(e) => setAvatar(e.target.value)}
          />
          <button onClick={handleRegister} className={cl.continueButtonAvatar}>
            Sign up
          </button>
        </div>
      )}
      <div className={cl.rightContainer}>
        <img
          draggable={false}
          className={cl.rightContainerImage}
          src={background}
          alt="background"
        />
      </div>
    </div>
  )
}
