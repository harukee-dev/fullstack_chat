import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setToken } from '../../slices/authSlice'
import { Link, useNavigate } from 'react-router-dom'
import cl from './LoginPage.module.css'
import { API_URL } from '../../constants'
import { setUser } from '../../slices/currentUserSlice'
import background from './images/background.png'
import arrowIcon from './images/arrow-icon.png'
import visibilityOn from './images/visibility-on-icon.png'
import visibilityOff from './images/visibility-off-icon.png'

export const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const loginRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const isButtonHidden = password !== '' && login !== ''
  const [isVisible, setIsVisible] = useState<boolean>(false)

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

  async function handleLogin() {
    setLogin(loginRef.current?.value || '')
    setPassword(passwordRef.current?.value || '')
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
  }

  return (
    <div className={cl.allPage}>
      <div className={cl.leftContainer}>
        <div>
          <h1 className={cl.welcomeText}>Welcome again.</h1>
          <Link className={cl.register} to={'/register'}>
            Dont have account? Sign up
          </Link>
        </div>
        <input
          className={cl.userInput}
          type="text"
          placeholder="login"
          ref={loginRef}
          onBlur={(e) => setLogin(e.target.value)}
        />
        <div className={cl.passwordAndButtonDiv}>
          <div className={cl.passwordContainer}>
            <input
              className={cl.passwordInput}
              type={isVisible ? 'text' : 'password'}
              onChange={(e) => setPassword(e.target.value)}
              ref={passwordRef}
              placeholder="password"
            />
            <button
              onClick={() => setIsVisible((v) => !v)}
              className={cl.showButton}
            >
              {isVisible ? 'hide' : 'show'}
            </button>
          </div>
          <button
            className={isButtonHidden ? cl.loginButton : cl.hiddenLoginButton}
            onClick={handleLogin}
          >
            <img
              className={isButtonHidden ? cl.arrowIcon : cl.hiddenArrowIcon}
              src={arrowIcon}
              alt="arrow-icon"
            />
          </button>
        </div>
        <p className={cl.error}>{error}</p>
      </div>
      <div className={cl.rightContainer}>
        <img
          className={cl.rightContainerImage}
          src={background}
          alt="background"
        />
      </div>
    </div>
  )
}
