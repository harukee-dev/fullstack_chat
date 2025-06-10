import React, { useEffect, useRef, useState } from 'react'
import { API_URL } from '../../constants'
import { Route, Routes, useNavigate } from 'react-router-dom'
import friendsIcon from './images/friends-gray.svg'
import cl from './friendRequestSender.module.css'
import messageIcon from './images/message-icon.svg'
import deleteFriendIcon from './images/delete-friend-icon.svg'
import { AppDispatch, useAppSelector } from '../../store'
import { useDispatch } from 'react-redux'
import { setFriends } from '../../slices/friendsSlice'
import acceptIcon from './images/accept-icon.svg'

interface IRequest {
  avatar: string
  id: string
  username: string
}

interface IProps {
  currentUserId: any
  socket: any
  allRequests: IRequest[]
  setAllRequests: any
}

export const FriendRequestSender: React.FC<IProps> = ({
  currentUserId,
  socket,
  allRequests,
  setAllRequests,
}) => {
  const [headerTab, setHeaderTab] = useState<string>('list')
  const [status, setStatus] = useState<string>('')
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const friends = useAppSelector((state) => state.friends.friends)

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
          element={
            <FriendsList currentUserId={currentUserId} socket={socket} />
          }
        />
        <Route
          path={'/pending'}
          element={
            <Pending
              allRequests={allRequests}
              setAllRequests={setAllRequests}
              socket={socket}
              currentUserId={currentUserId}
              setStatus={setStatus}
            />
          }
        />
        <Route
          path={'/add'}
          element={
            <AddFriend
              setAllRequests={setAllRequests}
              socket={socket}
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
  socket: any
}

const FriendsList: React.FC<IFriendsList> = ({ currentUserId, socket }) => {
  const friends = useAppSelector((state) => state.friends.friends)
  const dispatch = useDispatch<AppDispatch>()

  const friendsRef = useRef(friends)

  useEffect(() => {
    friendsRef.current = friends
  }, [friends])

  useEffect(() => {
    if (!socket) return

    socket.on(
      'friendAdded',
      (friendData: { _id: string; avatar: string; username: string }) => {
        dispatch(setFriends([...friends, friendData]))
        console.log('friend data: ', friendData)
      }
    )

    socket.on(
      'friendshipDeleted',
      (payload: { user1: string; user2: string }) => {
        const { user1, user2 } = payload

        const updatedFriends = friendsRef.current.filter(
          (el: any) => el.id !== user1 && el.id !== user2
        )
        console.log(`UPD: ${updatedFriends}`)
        dispatch(setFriends(updatedFriends))

        console.log(`CURRENT FRIENDS: ${friends}`)
      }
    )
  }, [socket])

  const handleDeleteFriend = async (
    requesterId: string,
    recipientId: string
  ) => {
    try {
      console.log(requesterId, recipientId)
      await fetch(API_URL + '/friends/deleteFriend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientId, requesterId }),
      })
      socket.emit('joinPersonalRoom', currentUserId)
      socket.emit('sendFriendDeleted', {
        user1: requesterId,
        user2: recipientId,
      })
    } catch (e) {
      console.log('Error fetching post "DELETE-FRIEND": ', e)
    }
  }

  return (
    <div className={cl.friendsList}>
      {friends.length > 0 ? (
        friends.map((el: any) => (
          <div
            key={el.username}
            className={cl.friendContainer}
            onClick={() => handleDeleteFriend(el.id, currentUserId)}
            onMouseMove={(e) => {
              const card = e.currentTarget as HTMLDivElement
              const rect = card.getBoundingClientRect()
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top

              const centerX = rect.width / 2
              const centerY = rect.height / 2

              const rotateX = ((y - centerY) / centerY) * -20
              const rotateY = ((x - centerX) / centerX) * 20

              card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`

              // Блик
              const glare = card.querySelector('::before') as HTMLElement
              const percentX = (x / rect.width) * 100
              const percentY = (y / rect.height) * 100
              card.style.setProperty('--glare-x', `${percentX}%`)
              card.style.setProperty('--glare-y', `${percentY}%`)
              card.style.setProperty('--glare-opacity', `1`)
            }}
            onMouseLeave={(e) => {
              const card = e.currentTarget as HTMLDivElement
              card.style.transform = 'rotateX(0deg) rotateY(0deg)'
              card.style.setProperty('--glare-opacity', `0`)
            }}
          >
            <img
              src={el.avatar}
              className={cl.avatarOnline}
              alt="user-avatar"
            />
            <p className={cl.friendUsername} style={{ color: 'white' }}>
              {el.username}
            </p>
          </div>
        ))
      ) : (
        <p className={cl.clearTitle}>It looks like you don't have friends...</p>
      )}
    </div>
  )
}

interface IPending {
  currentUserId: string
  setStatus: any
  socket: any
  allRequests: IRequest[]
  setAllRequests: any
}

const Pending: React.FC<IPending> = ({
  currentUserId,
  setStatus,
  socket,
  allRequests,
  setAllRequests,
}) => {
  const filterRequests = (id: string) => {
    setAllRequests((r: IRequest[]) => r.filter((el) => el.id !== id))
  }

  const handleAccept = async (requesterId: string, recipientId: string) => {
    console.log('1: ' + requesterId + ' 2: ' + recipientId)
    const response = await fetch(API_URL + '/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId, recipientId }),
    })

    socket.emit('addedFriendship', {
      user1: requesterId,
      user2: recipientId,
    })

    const data = await response.json()
    setStatus(data.message)
    filterRequests(requesterId)
  }

  const handleReject = async (requesterId: string, recipientId: string) => {
    const response = await fetch(API_URL + '/friends/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId, recipientId }),
    })

    const data = await response.json()

    setStatus(data.message)
    filterRequests(requesterId)
  }

  console.log(allRequests)

  return (
    <div className={cl.pendingContainer}>
      {allRequests.map((el) => (
        <div className={cl.pendingUser} key={el.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <img className={cl.pendingAvatar} src={el.avatar} alt="avatar" />
            <p className={cl.pendingUsername} style={{ color: 'white' }}>
              {el.username}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '3vh' }}>
            <button
              className={cl.buttonAccept}
              onClick={() => handleAccept(el.id, currentUserId)}
            >
              <img src={acceptIcon} alt="" />
            </button>
            <button
              className={cl.buttonReject}
              onClick={() => handleReject(el.id, currentUserId)}
            >
              <img src={deleteFriendIcon} alt="" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

interface IAddFriend {
  currentUserId: string
  setStatus: any
  status: string
  socket: any
  setAllRequests: any
}

const AddFriend: React.FC<IAddFriend> = ({
  currentUserId,
  setStatus,
  status,
  socket,
  setAllRequests,
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
        socket.emit('newRequest', {
          requesterId: currentUserId,
          recipientUsername: username,
        })
      } else {
        setStatus(data.message || 'Error occured')
      }
    } catch (error) {
      setStatus('fetch error to /friends/send-requiest')
    }
  }

  return (
    <div style={{ width: '95%', height: '100%' }}>
      <div className={cl.containerAddFriend}>
        <input
          className={cl.inputAddFriend}
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          disabled={username.length <= 0}
          className={cl.buttonAddFriend}
          onClick={sendRequest}
        >
          Send Invite
        </button>
      </div>
      <p className={cl.statusAddFriend}>{status}</p>
    </div>
  )
}
