import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setToken } from '../../slices/authSlice'
import { useNavigate } from 'react-router-dom'
import cl from './LoginPage.module.css'
import { API_URL } from '../../constants'
import { setUser } from '../../slices/currentUserSlice'
import lynkLogo from './images/lynk-logo.png'
import showPasswordIcon from './images/show-password-icon.png'

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

        navigate('/test')
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
        <div className={cl.logoAndNameContainer}>
          <img className={cl.lynkLogo} src={lynkLogo} alt="lynk" />
          <h1 className={cl.lynkText}>Lynk</h1>
        </div>
        <div className={cl.navigationContainer}>
          <button className={cl.loginLink}>Sign In</button>
          <button
            onClick={() => navigate('/register')}
            className={cl.registerLink}
          >
            Sign Up
          </button>
        </div>

        <div className={cl.inputsContainer}>
          <input
            className={cl.userInput}
            type="text"
            placeholder="Enter Username"
            ref={loginRef}
            onBlur={(e) => setLogin(e.target.value)}
          />

          <input
            className={cl.userInput}
            type={isVisible ? 'text' : 'password'}
            onChange={(e) => setPassword(e.target.value)}
            ref={passwordRef}
            placeholder="Enter Password"
          />

          <button
            onClick={() => setIsVisible((v) => !v)}
            className={
              isVisible ? cl.showPasswordButtonChecked : cl.showPasswordButton
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
            onClick={handleLogin}
            className={isButtonHidden ? cl.loginButton : cl.hiddenLoginButton}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
