import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setToken } from '../../slices/authSlice'
import { Link, useNavigate } from 'react-router-dom'
import cl from './LoginPage.module.css'
import Lines from './images/lines.png'

export const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()

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
    try {
      const response = await fetch('http://localhost:10000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('username', login)
        dispatch(setToken(data.token))
        navigate('/chat')
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
      <div className={cl.registerContainer}>
        <div className={cl.welcomeDiv}>
          <h1 className={cl.firstWelcomeText}>Hello.</h1>
          <p className={cl.secondWelcomeText}>Welcome back</p>
        </div>
        <input
          className={cl.input}
          onBlur={(e) => setLogin(e.target.value)}
          placeholder="Login"
          type="text"
        />
        <input
          className={cl.input}
          onBlur={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />
        <button className={cl.loginButton} onClick={handleLogin}>
          Sign In
        </button>
        <Link className={cl.register} to={'/register'}>
          I dont have account
        </Link>
        <p className={cl.error}>{error}</p>
      </div>
    </div>
  )
}
