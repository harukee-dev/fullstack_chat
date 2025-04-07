import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cl from './RegisterPage.module.css'

export const Register = () => {
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

  async function handleRegister() {
    const regex = /[a-zA-Zа-яА-ЯёЁ]/
    if (regex.test(login)) {
      try {
        const response = await fetch(
          'https://fullstack-chat-6mbf.onrender.com/auth/registration',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: login, password }),
          }
        )

        if (response.ok) {
          navigate('/login')
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

  return (
    <div className={cl.allPage}>
      <div className={cl.registerContainer}>
        <div className={cl.welcomeDiv}>
          <h1 className={cl.firstWelcomeText}>Hello.</h1>
          <p className={cl.secondWelcomeText}>Sign Up to Get Started</p>
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
        <button className={cl.loginButton} onClick={handleRegister}>
          Sign Up
        </button>
        <Link className={cl.register} to={'/login'}>
          I already have an account
        </Link>
        <p className={cl.error}>{error}</p>
      </div>
    </div>
  )
}
