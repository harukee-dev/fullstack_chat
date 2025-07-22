import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cl from './RegisterPage.module.css'
import { API_URL } from '../../constants'
import background from '../LoginPage/images/background.png'
import { setToken } from '../../slices/authSlice'
import { setUser } from '../../slices/currentUserSlice'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { motion } from 'framer-motion'

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
  const difficulty = getPasswordDifficulty(strength)

  return (
    <div className={cl.allPage}>
      {step === 'info' ? (
        <div className={cl.leftContainer}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0 }}
          >
            <h1 className={cl.welcomeText}>Welcome.</h1>
            <Link className={cl.register} to={'/login'}>
              Already have account? Sign in
            </Link>
          </motion.div>
          <motion.input
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className={cl.userInput}
            type="text"
            placeholder="login"
            onBlur={(e) => setLogin(e.target.value)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className={cl.passwordContainer}
          >
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
          </motion.div>
          <div className={cl.passwordAndButtonDiv}>
            <motion.input
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className={cl.userInput}
              type={isVisiblePassword ? 'text' : 'password'}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="confirm password"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className={cl.visibilityContainer}
          >
            <div
              className={isVisiblePassword ? cl.checkboxChecked : cl.checkbox}
              onClick={() => setIsVisiblePassword((v) => !v)}
            />
            <p className={cl.visibilityText}>show password</p>
          </motion.div>
          {error && <p className={cl.error}>{error}</p>}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            disabled={!isButtonHidden}
            onClick={handleRegister}
            className={cl.continueButton}
          >
            Continue
          </motion.button>
        </div>
      ) : (
        <div className={cl.leftContainerAvatar}>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0 }}
            className={cl.welcomeTextAvatar}
          >
            Set your avatar
          </motion.h1>
          <motion.img
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className={cl.userAvatar}
            src={avatar}
            alt="user-avatar"
          />
          <motion.input
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className={cl.userInputAvatar}
            type="text"
            placeholder="Enter image url"
            onBlur={(e) =>
              e.target.value === ''
                ? setAvatar(
                    'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png'
                  )
                : setAvatar(e.target.value)
            }
          />
          <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            onClick={changeAvatar}
            className={cl.continueButtonAvatar}
          >
            {avatar ===
            'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png'
              ? 'Later'
              : 'Save'}
          </motion.button>
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
