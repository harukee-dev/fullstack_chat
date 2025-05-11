import React, { useEffect, useState } from 'react'
import { API_URL } from '../../constants'

interface IProps {
  currentUserId: any
}

export const FriendRequestSender: React.FC<IProps> = ({ currentUserId }) => {
  const [username, setUsername] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [allRequests, setAllRequests] = useState<string[]>([])

  const sendRequest = async () => {
    try {
      const response = await fetch(API_URL + '/friends/send-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requesterId: currentUserId,
          recipientUsername: username,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus(data.message)
      } else {
        setStatus(data.message || 'Error occured')
      }
    } catch (error) {
      setStatus('fetch error to /friends/send-requiest')
    }
  }

  async function fetchFriendRequests(userId: string) {
    const response = await fetch(`${API_URL}/friends/requests/${userId}`)
    const data = await response.json()

    if (response.ok) {
      return data // массив заявок
    } else {
      console.error('Ошибка при получении заявок:', data.message)
      return []
    }
  }

  useEffect(() => {
    setAllRequests([])
    async function loadRequests() {
      if (!currentUserId) return

      const requests = await fetchFriendRequests(currentUserId)

      console.log(requests) // теперь это будет обычный массив объектов

      // например, получаем никнеймы отправителей:
      requests.forEach((req: any) => {
        setAllRequests((r) => [...r, req.requesterId.username])
      })
    }
    loadRequests()
  }, [])

  return (
    <div>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button onClick={sendRequest}>Send friend request</button>
      <p style={{ color: 'white' }}>{status}</p>
      <p style={{ color: 'white' }}>Requests:</p>
      {allRequests.map((el) => (
        <p key={el} style={{ color: 'white' }}>
          {el}
        </p>
      ))}
    </div>
  )
}
