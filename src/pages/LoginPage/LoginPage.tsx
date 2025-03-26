import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setToken } from '../../slices/authSlice'
import { Link, useNavigate } from 'react-router-dom'

export const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const navigate = useNavigate()

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
        dispatch(setToken(data.token))
        navigate('/chat')
      } else {
        console.error('Ошибка:', data.message)
      }
    } catch (error) {
      console.error('Ошибка запроса:', error)
    }
  }

  return (
    <div>
      <h1>Login</h1>
      <input
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        placeholder="username"
        type="text"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        type="text"
      />
      <button onClick={handleLogin}>Login</button>
      <Link to={'/register'}>Еще нет аккаунта?</Link>
    </div>
  )
}
