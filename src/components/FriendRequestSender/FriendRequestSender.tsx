import React, { useEffect, useState } from 'react'
import { API_URL } from '../../constants'

interface IProps {
  currentUserId: any
}

interface IRequest {
  id: string
  username: string
}

export const FriendRequestSender: React.FC<IProps> = ({ currentUserId }) => {
  const [username, setUsername] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [allRequests, setAllRequests] = useState<IRequest[]>([])
  const [friends, setFriends] = useState<any>([])

  const fetchFriends = async (userId: string) => {
    const response = await fetch(API_URL + '/friends/list/' + userId)
    setFriends(response.ok ? await response.json() : [])
  }

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

      console.log(requests)
      requests.forEach((req: any) => {
        setAllRequests((r) => [
          ...r,
          { id: req.requesterId, username: req.requesterId.username },
        ])
      })
    }
    loadRequests()
  }, [])

  const handleAccept = async (requesterId: string, recipientId: string) => {
    const response = await fetch(API_URL + '/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId, recipientId }),
    })

    const data = await response.json()
    setStatus(data.message)
  }

  const handleReject = async (requesterId: string, recipientId: string) => {
    const response = await fetch(API_URL + '/friends/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId, recipientId }),
    })

    const data = await response.json()

    setStatus(data.message)
  }

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
        <div>
          <p key={el.id} style={{ color: 'white' }}>
            {el.username}
          </p>
          <button onClick={() => handleAccept(el.id, currentUserId)}>
            accept
          </button>
          <button onClick={() => handleReject(el.id, currentUserId)}>
            reject
          </button>
        </div>
      ))}
      <h1 style={{ color: 'white' }}>Friends</h1>
      <button onClick={() => fetchFriends(currentUserId)}>fetch</button>
      {friends.length > 0 ? (
        friends.map((el: any) => (
          <p key={el.username} style={{ color: 'white' }}>
            {el.username}
          </p>
        ))
      ) : (
        <p style={{ color: 'white' }}>you dont have friends</p>
      )}
    </div>
  )
}
