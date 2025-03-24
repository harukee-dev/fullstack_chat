import { useState } from 'react'

export const Register = () => {
  const [login, setLogin] = useState<string>('')
  const [password, setPassword] = useState<string>('')

  async function handleRegister() {
    try {
      const response = await fetch('http://localhost:10000/auth/registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: login, password }),
      })

      console.log(response.json())
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div>
      <h1>Register</h1>
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
      <button onClick={handleRegister}>register</button>
    </div>
  )
}
