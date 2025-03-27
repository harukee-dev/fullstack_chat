import { useState } from 'react'
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
  const navigate = useNavigate()

  async function handleLogin() {
    try {
      const response = await fetch('http://95.174.112.204:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.token)
        dispatch(setToken(data.token))
        navigate('/chat')
      } else {
        console.error('Ошибка:', data.message)
      }
    } catch (error) {
      console.error('Ошибка запроса:', error)
    }
  }

  function hidePassword() {
    return '*'.repeat(password.split('').length)
  }

  return (
    <div className={cl.allPage}>
      <div className={cl.leftContainer}>
        <h1 className={cl.websiteName}>Harukee messenger</h1>
        <p className={cl.websiteDescription}>My fullstack messenger app</p>
        <button className={cl.readMoreButton}>Read More</button>
        <img className={cl.lines} src={Lines} alt="*" />
      </div>
      <div className={cl.rightContainer}>
        <div className={cl.welcomeDiv}>
          <h1 className={cl.firstWelcomeText}>Hello again!</h1>
          <p className={cl.secondWelcomeText}>Welcome back</p>
        </div>
        <input
          className={cl.input}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Login"
          type="text"
        />
        <input
          className={cl.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="text"
        />
        <button className={cl.loginButton} onClick={handleLogin}>
          Login
        </button>
        <Link className={cl.register} to={'/register'}>
          I dont have account
        </Link>
      </div>
    </div>
  )
}
