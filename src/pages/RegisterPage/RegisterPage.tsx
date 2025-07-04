import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cl from './RegisterPage.module.css'
import { API_URL } from '../../constants'
import background from '../LoginPage/images/background.png'
import arrowIcon from '../LoginPage/images/arrow-icon.png'

export const Register = () => {
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const navigate = useNavigate()
  const isButtonHidden =
    password !== '' && login !== '' && password === confirmPassword

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
        const response = await fetch(API_URL + '/auth/registration', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: login, password }),
        })

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
        <input
          className={cl.userInput}
          type={showPassword ? 'text' : 'password'}
          onMouseEnter={() => setShowPassword(true)}
          onMouseLeave={() => setShowPassword(false)}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
        />
        <div className={cl.passwordAndButtonDiv}>
          <input
            className={cl.userInput}
            type={showPassword ? 'text' : 'password'}
            onMouseEnter={() => setShowPassword(true)}
            onMouseLeave={() => setShowPassword(false)}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="confirm password"
          />
          <button
            className={isButtonHidden ? cl.loginButton : cl.hiddenLoginButton}
            onClick={handleRegister}
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
