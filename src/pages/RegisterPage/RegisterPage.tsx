import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import cl from './RegisterPage.module.css'
import Lines from '../LoginPage/images/lines.png'

export const Register = () => {
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const navigate = useNavigate()

  async function handleRegister() {
    try {
      const response = await fetch(
        'http://95.174.112.204:10000/auth/registration',
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
      }
    } catch (error) {
      console.error(error)
    }
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
          <h1 className={cl.firstWelcomeText}>Hello!</h1>
          <p className={cl.secondWelcomeText}>Sign Up to Get Started</p>
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
        <button className={cl.loginButton} onClick={handleRegister}>
          Register
        </button>
        <Link className={cl.register} to={'/login'}>
          I already have an account
        </Link>
      </div>
    </div>
  )
}
