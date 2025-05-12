import React, { useEffect, useState } from 'react'
import { API_URL } from '../../constants'
import { Route, Routes, useNavigate } from 'react-router-dom'
import friendsIcon from './images/friends-gray.svg'
import cl from './friendRequestSender.module.css'

interface IProps {
  currentUserId: any
}

interface IRequest {
  id: string
  username: string
}

export const FriendRequestSender: React.FC<IProps> = ({ currentUserId }) => {
  const [headerTab, setHeaderTab] = useState<string>()
  const [status, setStatus] = useState<string>('')
  const navigate = useNavigate()

  // HEADER HANDLERS

  const handleAll = () => {
    setHeaderTab('list')
    navigate('/main/friends/list')
  }

  const handlePending = () => {
    setHeaderTab('pending')
    navigate('/main/friends/pending')
  }

  const handleAdd = () => {
    setHeaderTab('add')
    navigate('/main/friends/add')
  }

  return (
    // <div>
    //   <input
    //     type="text"
    //     placeholder="Username"
    //     value={username}
    //     onChange={(e) => setUsername(e.target.value)}
    //   />
    //   <button onClick={sendRequest}>Send friend request</button>
    //   <p style={{ color: 'white' }}>{status}</p>
    //   <p style={{ color: 'white' }}>Requests:</p>
    //   {allRequests.map((el) => (
    //     <div>
    //       <p key={el.id} style={{ color: 'white' }}>
    //         {el.username}
    //       </p>
    //       <button onClick={() => handleAccept(el.id, currentUserId)}>
    //         accept
    //       </button>
    //       <button onClick={() => handleReject(el.id, currentUserId)}>
    //         reject
    //       </button>
    //     </div>
    //   ))}
    //   <h1 style={{ color: 'white' }}>Friends</h1>
    //   <button onClick={() => fetchFriends(currentUserId)}>fetch</button>
    //   {friends.length > 0 ? (
    //     friends.map((el: any) => (
    //       <p key={el.username} style={{ color: 'white' }}>
    //         {el.username}
    //       </p>
    //     ))
    //   ) : (
    //     <p style={{ color: 'white' }}>you dont have friends</p>
    //   )}
    // </div>
    <div className={cl.friendsPage}>
      <header className={cl.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1vh' }}>
          <img
            style={{ height: '3.5vh' }}
            src={friendsIcon}
            alt="friends-icon"
          />
          <p className={cl.friendsTitle}>Friends</p>
        </div>
        <div
          style={{
            width: '2.2vw',
            height: '1px',
            backgroundColor: '#4E4E4E',
          }}
        ></div>
        <button
          onClick={handleAll}
          className={
            headerTab === 'list' ? cl.headerActiveButton : cl.headerButton
          }
        >
          All
        </button>
        <button
          onClick={handlePending}
          className={
            headerTab === 'pending' ? cl.headerActiveButton : cl.headerButton
          }
        >
          Pending
        </button>
        <button
          onClick={handleAdd}
          className={
            headerTab === 'add' ? cl.headerActiveButton : cl.headerButton
          }
        >
          Add friend
        </button>
      </header>
      <Routes>
        <Route
          path={'/list'}
          element={<FriendsList currentUserId={currentUserId} />}
        />
        <Route
          path={'/pending'}
          element={
            <Pending currentUserId={currentUserId} setStatus={setStatus} />
          }
        />
        <Route
          path={'/add'}
          element={
            <AddFriend
              setStatus={setStatus}
              status={status}
              currentUserId={currentUserId}
            />
          }
        />
      </Routes>
    </div>
  )
}

interface IFriendsList {
  currentUserId: string
}

const FriendsList: React.FC<IFriendsList> = ({ currentUserId }) => {
  const [friends, setFriends] = useState<any>([])

  const fetchFriends = async (userId: string) => {
    const response = await fetch(API_URL + '/friends/list/' + userId)
    setFriends(response.ok ? await response.json() : [])
  }

  useEffect(() => {
    fetchFriends(currentUserId)
  }, [])
  return (
    <div>
      <h1 style={{ color: 'white' }}>Friends</h1>
      //{' '}
      {friends.length > 0 ? (
        friends.map((el: any) => (
          <p key={el.username} style={{ color: 'white' }}>
            {el.username}
          </p>
        ))
      ) : (
        <p style={{ color: 'white' }}>Loading</p>
      )}
    </div>
  )
}

interface IPending {
  currentUserId: string
  setStatus: any
}

const Pending: React.FC<IPending> = ({ currentUserId, setStatus }) => {
  const [allRequests, setAllRequests] = useState<IRequest[]>([])

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
    </div>
  )
}

interface IAddFriend {
  currentUserId: string
  setStatus: any
  status: string
}

const AddFriend: React.FC<IAddFriend> = ({
  currentUserId,
  setStatus,
  status,
}) => {
  const [username, setUsername] = useState<string>('')

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
    </div>
  )
}
