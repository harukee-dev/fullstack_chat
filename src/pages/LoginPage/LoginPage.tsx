import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, useAppSelector } from '../../store'
import { setToken } from '../../slices/authSlice'
import { Link, useNavigate } from 'react-router-dom'
import cl from './LoginPage.module.css'
import { API_URL } from '../../constants'
import { setUser } from '../../slices/currentUserSlice'

export const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const loginRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

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
      {/* <div className={cl.registerContainer}>
        <div className={cl.welcomeDiv}>
          <h1 className={cl.firstWelcomeText}>Hello.</h1>
          <p className={cl.secondWelcomeText}>Welcome back</p>
        </div>
        <input
          className={cl.input}
          onBlur={(e) => setLogin(e.target.value)}
          placeholder="Login"
          type="text"
          ref={loginRef}
        />
        <input
          className={cl.input}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          ref={passwordRef}
        />
        <button className={cl.loginButton} onClick={handleLogin}>
          Sign In
        </button>
        <Link className={cl.register} to={'/register'}>
          I dont have account
        </Link>
        <p className={cl.error}>{error}</p>
      </div> */}
      <div className={cl.leftContainer}>
        <h1 className={cl.welcomeText}>Welcome again.</h1>
        <input className={cl.input} type="text" placeholder="login" />
        <div className={cl.passwordAndButtonDiv}>
          <input className={cl.input} type="password" placeholder="password" />
          <button className={cl.loginButton}></button>
        </div>
        <Link className={cl.register} to={'/register'}>
          Dont have account? Sign up
        </Link>
      </div>
      <div className={cl.rightContainer}>
        <img className={cl.rightContainerImage} src="" alt="" />
      </div>
    </div>
  )
}
