import React, { useEffect, useState } from 'react'
import { API_URL } from '../../constants'
import { Route, Routes, useNavigate } from 'react-router-dom'
import friendsIcon from './images/friends-gray.svg'
import cl from './friendRequestSender.module.css'
import messageIcon from './images/message-icon.svg'
import deleteFriendIcon from './images/delete-friend-icon.svg'
import { AppDispatch, useAppSelector } from '../../store'
import { useDispatch } from 'react-redux'
import { setFriends } from '../../slices/friendsSlice'

interface IRequest {
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
  const { friends } = useAppSelector((state) => state.friends)
  const dispatch = useDispatch<AppDispatch>()

  console.log(friends)

  useEffect(() => {
    if (!socket) return

    socket.on(
      'friendAdded',
      (friendData: { _id: string; avatar: string; username: string }) => {
        dispatch(
          setFriends([
            ...friends,
            {
              avatar: friendData.avatar,
              id: friendData._id,
              username: friendData.username,
            },
          ])
        )
        console.log('friend data: ', friendData)
      }
    )

    socket.on(
      'friendshipDeleted',
      (payload: { user1: string; user2: string }) => {
        const { user1, user2 } = payload
        dispatch(
          setFriends(
            friends.filter(
              (el: any) =>
                (el.requesterId !== user1 && el.recipientId !== user2) ||
                (el.requesterId !== user2 && el.recipientId !== user1)
            )
          )
        )
        console.log('deletet ' + user1, user2)
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
      {' '}
      {friends.length > 0 ? (
        friends.map((el: any) => (
          <div
            key={el.username}
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <div className={cl.friendContainer}>
              <img
                src={el.avatar}
                className={cl.avatarOnline}
                alt="user-avatar"
              />
              <p
                key={el.username}
                className={cl.friendUsername}
                style={{ color: 'white' }}
              >
                {el.username}
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                marginRight: '10vh',
                gap: '3vh',
                alignItems: 'center',
              }}
            >
              <img
                className={cl.deleteFriendButton}
                onClick={() => handleDeleteFriend(el.id, currentUserId)}
                src={deleteFriendIcon}
                alt="delete-friend-icon"
              />
            </div>
          </div>
        ))
      ) : (
        <p style={{ color: 'white' }}>Oops.. something went wrong</p>
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
