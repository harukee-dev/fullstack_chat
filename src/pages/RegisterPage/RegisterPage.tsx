import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cl from './RegisterPage.module.css'
import { API_URL } from '../../constants'
import { setToken } from '../../slices/authSlice'
import { setUser } from '../../slices/currentUserSlice'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import lynkLogo from '../LoginPage/images/lynk-logo.png'
import showPasswordIcon from '../LoginPage/images/show-password-icon.png'

export const Register = () => {
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isVisiblePassword, setIsVisiblePassword] = useState<boolean>(false)
  const [step, setStep] = useState<'info' | 'avatar'>('avatar')
  const [avatar, setAvatar] = useState<string>(
    // 'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png'
    'https://i.pinimg.com/736x/85/e8/fc/85e8fccc2983bdc283adbdaa6d761e25.jpg'
  )
  const navigate = useNavigate()
  const isButtonHidden = password !== '' && login !== ''

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
        return 'normal'
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
    if (password.length < 8) {
      setError('password is too short')
    } else {
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

                setStep('avatar')
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
        setError('invalid login')
      }
    }
  }

  async function changeAvatar() {
    const userId = localStorage.getItem('user-id')
    try {
      const response = await fetch(API_URL + '/auth/changeAvatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, avatar }),
      })
      const data = await response.json()
      if (response.ok) {
        localStorage.setItem('avatar', data)
        navigate('/main')
      } else {
        console.error(data.message)
      }
    } catch (e) {
      console.log(e)
    }
  }

  const strength = getPasswordStrength(password)

  return (
    <div className={cl.allPage}>
      {step === 'info' ? (
        <div className={cl.leftContainer}>
          <div className={cl.logoAndNameContainer}>
            <img className={cl.lynkLogo} src={lynkLogo} alt="lynk" />
            <h1 className={cl.lynkText}>Lynk</h1>
          </div>
          <div className={cl.navigationContainer}>
            <button onClick={() => navigate('/login')} className={cl.loginLink}>
              Sign In
            </button>
            <button className={cl.registerLink}>Sign Up</button>
          </div>
          <div className={cl.inputsContainer}>
            <input
              className={cl.userInput}
              type="text"
              placeholder="Enter Username"
              onBlur={(e) => setLogin(e.target.value)}
            />
            <input
              className={cl.userInput}
              type={isVisiblePassword ? 'text' : 'password'}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
            />

            <button
              onClick={() => setIsVisiblePassword((v) => !v)}
              className={
                isVisiblePassword
                  ? cl.showPasswordButtonChecked
                  : cl.showPasswordButton
              }
            >
              <img
                className={cl.showPasswordIcon}
                src={showPasswordIcon}
                alt="show-password"
              />
            </button>

            {error && <p className={cl.error}>{error}</p>}
            <button
              disabled={!isButtonHidden}
              onClick={handleRegister}
              className={isButtonHidden ? cl.loginButton : cl.hiddenLoginButton}
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className={cl.leftContainer}>
          <h1 className={cl.lynkText}>Set avatar</h1>
          <img className={cl.userAvatar} src={avatar} alt="user-avatar" />
          <div className={cl.inputsContainer}>
            <input
              className={cl.userInput}
              type="text"
              placeholder="Enter image url"
              onChange={(e) =>
                e.target.value === ''
                  ? setAvatar(
                      'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png'
                    )
                  : setAvatar(e.target.value)
              }
            />
            <button onClick={changeAvatar} className={cl.loginButton}>
              {avatar ===
              'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png'
                ? 'Later'
                : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
