const jwt = require('jsonwebtoken')
const Message = require('./models/Message')
const { secret } = require('./config')
const User = require('./models/User')
const Chat = require('./models/Chat')
const ACTIONS = require('./actions')
const { version, validate } = require('uuid')

// Множества пользователей
const typingUsers = new Set()
const onlineUsers = new Map()
const roomUsers = new Map()

function getClientRooms(io) {
  const { rooms } = io.sockets.adapter

  return Array.from(rooms.keys()).filter(
    (roomID) => validate(roomID) && version(roomID) === 4
  )
}

function shareRoomsInfo(io) {
  io.emit(ACTIONS.SHARE_ROOMS, { rooms: getClientRooms(io) })
}

// Аутентификация по JWT
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token
  if (!token) return next(new Error('Нет токена'))

  try {
    const decoded = jwt.verify(token, secret)
    socket.user = decoded
    next()
  } catch (error) {
    console.log('Ошибка при аутентификации:', error)
  }
}

// Обработчики событий
async function handleMessage(io, socket, message) {
  if (!message || !message.text || !message.chatId) return

  const reply = {
    username: message.replyUser || null,
    text: message.replyText || null,
  }

  const newMessageData = {
    text: message.text,
    timestamp: Date.now(),
    senderId: message.senderId,
    chatId: message.chatId, // ← добавляем chatId
  }

  if (reply.username && reply.text) {
    newMessageData.replyMessage = reply
  }

  try {
    const newMessage = new Message(newMessageData)
    const savedMessage = await newMessage.save()

    const populatedMessage = await savedMessage.populate(
      'senderId',
      'username avatar'
    )

    const currentChat = await Chat.findByIdAndUpdate(
      populatedMessage.chatId,
      {
        updatedAt: Date.now(),
      },
      { new: true }
    )

    const currentChatMembers = currentChat.members

    const emittedMessage = {
      _id: populatedMessage._id.toString(),
      text: populatedMessage.text,
      timestamp: populatedMessage.timestamp,
      chatId: message.chatId,
      senderId: {
        _id: populatedMessage.senderId._id,
        username: populatedMessage.senderId.username,
        avatar: populatedMessage.senderId.avatar,
      },
      ...(reply.username && reply.text && { replyMessage: reply }),
    }

    io.to(message.chatId).emit('message', emittedMessage)
    currentChatMembers.forEach((member) => {
      io.to(member.toString()).emit('chatUpdated', {
        id: currentChat._id,
        updatedAt: currentChat.updatedAt,
      })
      if (member._id !== emittedMessage.senderId._id)
        io.to(member.toString()).emit('new-message', emittedMessage)
    })
  } catch (error) {
    console.error('Ошибка при сохранении сообщения:', error)
  }
}

async function handlePin(io, _id) {
  try {
    const pinnedMessage = await Message.findByIdAndUpdate(
      _id,
      { isPinned: true },
      { new: true }
    )

    if (!pinnedMessage) {
      console.log('!pinned message ERR')
      return
    }

    const populated = await pinnedMessage.populate(
      'senderId',
      'username avatar'
    )

    const chat = await Chat.findById(pinnedMessage.chatId).lean()
    if (!chat || !chat.members) {
      console.log('Chat not found or has no members')
      return
    }

    io.to(populated.chatId.toString()).emit('messagePinned', populated)

    chat.members.forEach((memberId) => {
      if (memberId.toString() !== populated.senderId._id.toString()) {
        io.to(memberId.toString()).emit('new-pinned', populated)
      }
    })
  } catch (e) {
    console.error('Error in handlePin:', e)
  }
}

async function handleUnpin(io, _id) {
  try {
    const unpinnedMessage = await Message.findByIdAndUpdate(
      _id,
      { isPinned: false },
      { new: true }
    )

    if (!unpinnedMessage) {
      console.error('Ошибка при откреплении сообщения')
      return
    }

    const populated = await unpinnedMessage.populate(
      'senderId',
      'username avatar'
    )

    const chat = await Chat.findById(populated.chatId).lean()
    if (!chat || !chat.members) {
      console.error('Чат не найден или не содержит участников')
      return
    }

    io.to(populated.chatId.toString()).emit('messageUnpinned', populated)

    chat.members.forEach((memberId) => {
      if (memberId.toString() !== populated.senderId._id.toString()) {
        io.to(memberId.toString()).emit('new-unpin', populated)
      }
    })
  } catch (error) {
    console.error('Ошибка в handleUnpin:', error)
  }
}

async function handleDelete(io, socket, _id) {
  try {
    const deletedMessage = await Message.findById(_id).lean()
    if (!deletedMessage) {
      socket.emit('error', { message: 'Message not found' })
      return
    }

    await Message.deleteOne({ _id })

    const chat = await Chat.findById(deletedMessage.chatId).lean()
    if (!chat || !chat.members) {
      console.error('Чат не найден или не содержит участников')
      return
    }

    io.to(deletedMessage.chatId.toString()).emit(
      'messageDeleted',
      deletedMessage
    )

    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit('new-delete', deletedMessage)
    })
  } catch (e) {
    console.error('Ошибка при удалении сообщения:', e)
    socket.emit('error', { message: 'Failed to delete message' })
  }
}

async function handleEdit(io, _id, text) {
  try {
    const updatedMessage = await Message.findByIdAndUpdate(
      _id,
      { text },
      { new: true }
    )
      .populate('senderId', 'username avatar')
      .lean()

    if (!updatedMessage || !updatedMessage.chatId) {
      console.error('Сообщение не найдено или нет chatId')
      return
    }

    const chat = await Chat.findById(updatedMessage.chatId).lean()
    if (!chat || !chat.members) {
      console.error('Чат не найден или не содержит участников')
      return
    }

    io.to(updatedMessage.chatId.toString()).emit(
      'messageEdited',
      updatedMessage
    )

    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit('new-edit', updatedMessage)
    })
  } catch (e) {
    console.error('Ошибка при изменении сообщения:', e)
  }
}

// function handleEdit(io, _id, text) {
//   Message.findByIdAndUpdate(_id, { text }, { new: true })
//     .then((updated) => {
//       if (updated) io.emit('messageEdited', updated)
//     })
//     .catch((error) => {
//       console.error('Ошибка при редактировании сообщения:', error)
//     })
// }

const userSockets = new Map()

// Основная инициализация сокетов
function setupSocketHandlers(io) {
  io.use(authenticateSocket)

  io.on('connection', async (socket) => {
    shareRoomsInfo(io)
    const userId = socket.user.id
    userSockets.set(userId.toString(), socket.id)
    socket.join(userId.toString())

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set())
    }

    onlineUsers.get(userId).add(socket.id)

    // Объявляем один раз в скоупе коннекта
    const chatParticipants = new Set()

    try {
      const user = await User.findById(userId).select('userChats')
      if (!user) return

      const chats = await Chat.find({ _id: { $in: user.userChats } }).select(
        'members'
      )

      chats.forEach((chat) => {
        chat.members.forEach((memberId) => {
          const id = memberId.toString()
          if (id !== userId) {
            chatParticipants.add(id)
          }
        })
      })

      for (const participantId of chatParticipants) {
        const sockets = onlineUsers.get(participantId)
        if (sockets) {
          sockets.forEach((sockId) => {
            io.to(sockId).emit('user-online', userId)
          })
        }
      }
    } catch (error) {
      console.error('Ошибка при получении участников чатов:', error)
    }
    try {
      const user = await User.findById(userId).select('userChats')
      if (!user) return

      const chats = await Chat.find({ _id: { $in: user.userChats } }).select(
        'members'
      )

      const participantIds = new Set()
      chats.forEach((chat) => {
        chat.members.forEach((memberId) => {
          const id = memberId.toString()
          if (id !== userId && onlineUsers.has(id)) {
            participantIds.add(id)
          }
        })
      })

      socket.emit('onlineChatUsersList', Array.from(participantIds))
    } catch (err) {
      console.error('Ошибка в getOnlineChatUsers:', err)
    }

    socket.on('joinChatRoom', (chatId) => {
      if (!chatId) return
      socket.join(chatId)
      // console
      //   .log
      //   `Пользователь ${socket.id} присоединился к комнате чата ${chatId}`
      //   ()
    })

    console.log('Socket handler initialized for:', socket.id)

    socket.on('sendFriendDeleted', ({ user1, user2 }) => {
      io.to(user1.toString()).emit('friendshipDeleted', { user1, user2 })
      io.to(user2.toString()).emit('friendshipDeleted', { user1, user2 })
    })

    socket.on('addedFriendship', async ({ user1, user2 }) => {
      try {
        const [userOne, userTwo] = await Promise.all([
          User.findById(user1.toString()).select('username avatar'),
          User.findById(user2.toString()).select('username avatar'),
        ])

        if (userOne && userTwo) {
          // Отправляем каждому информацию о другом
          io.to(user1.toString()).emit('friendAdded', {
            id: userTwo._id,
            username: userTwo.username,
            avatar: userTwo.avatar,
          })

          io.to(user2.toString()).emit('friendAdded', {
            id: userOne._id,
            username: userOne.username,
            avatar: userOne.avatar,
          })
        }
      } catch (err) {
        console.error('Ошибка при отправке friendAdded:', err)
      }
    })

    socket.on('newRequest', async ({ requesterId, recipientUsername }) => {
      const requester = await User.findOne({ _id: requesterId })
      const recipient = await User.findOne({ username: recipientUsername })
      if (!recipient || !requester) return
      io.to(recipient._id.toString()).emit('newRequest', {
        avatar: requester.avatar,
        id: requesterId,
        username: requester.username,
      })
    })

    // События чата
    socket.on('message', (msg) => handleMessage(io, socket, msg))
    socket.on('editMessage', ({ _id, text }) => handleEdit(io, _id, text))
    socket.on('deleteMessage', ({ _id }) => handleDelete(io, socket, _id))
    socket.on('closeInteractions', (messageId) => {
      socket.emit('openedInteraction', messageId._id)
    })

    // Пины
    socket.on('newPin', ({ _id }) => handlePin(io, _id))
    socket.on('unpin', ({ _id }) => handleUnpin(io, _id))

    socket.on('friendshipDeleted', async ({ user1, user2 }) => {
      console.log('friendshipDeleted socket server', user1, user2)
      console.log(user1, user2)

      io.to(user1.toString(), user2.toString()).emit('friendshipDeleted', {
        user1,
        user2,
      })
    })

    socket.on('disconnect', () => {
      const socketsOfUser = onlineUsers.get(userId)
      if (!socketsOfUser) return

      socketsOfUser.delete(socket.id)

      if (socketsOfUser.size === 0) {
        onlineUsers.delete(userId)
        userSockets.delete(userId)

        // Уведомляем участников чатов, что пользователь оффлайн
        chatParticipants.forEach((participantId) => {
          io.to(participantId).emit('user-offline', { userId })
        })
      }
    })
    socket.on(ACTIONS.JOIN, async (config) => {
      const { room: roomID, userId } = config
      if (!roomID) return

      // Получаем информацию о пользователе из базы данных
      let userInfo = {}
      try {
        const user = await User.findById(userId).select('username avatar')
        if (user) {
          userInfo = {
            userId: user._id.toString(),
            username: user.username,
            avatar: user.avatar,
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }

      // 1️⃣ Сразу добавляем сокет в комнату
      socket.join(roomID)

      // 2️⃣ Сохраняем информацию о пользователе
      if (!roomUsers.has(roomID)) {
        roomUsers.set(roomID, new Map())
      }
      roomUsers.get(roomID).set(socket.id, userInfo)

      // 3️⃣ Список всех клиентов в комнате с информацией о пользователях
      const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || [])
      const clientsWithInfo = clients.map((clientID) => ({
        peerID: clientID,
        userInfo: roomUsers.get(roomID).get(clientID) || {},
      }))

      // 4️⃣ Сообщаем каждому клиенту про всех остальных с информацией о пользователях
      clientsWithInfo.forEach(({ peerID, userInfo: clientUserInfo }) => {
        if (peerID === socket.id) return

        // Старые клиенты узнают о новом
        io.to(peerID).emit(ACTIONS.ADD_PEER, {
          peerID: socket.id,
          userInfo, // Добавляем информацию о пользователе
          createOffer: false,
        })

        // Новый клиент узнает о старых
        socket.emit(ACTIONS.ADD_PEER, {
          peerID: peerID,
          userInfo: clientUserInfo, // Добавляем информацию о пользователе
          createOffer: true,
        })
      })

      // 5️⃣ Обновляем комнаты у всех
      shareRoomsInfo(io)
    })
    function leaveRoom() {
      const { rooms } = socket

      Array.from(rooms).forEach((roomID) => {
        // Удаляем информацию о пользователе
        if (roomUsers.has(roomID)) {
          roomUsers.get(roomID).delete(socket.id)
          if (roomUsers.get(roomID).size === 0) {
            roomUsers.delete(roomID)
          }
        }

        const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || [])
        clients.forEach((clientID) => {
          io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
            peerID: socket.id,
          })

          socket.emit(ACTIONS.REMOVE_PEER, {
            peerID: clientID,
          })
        })

        socket.leave(roomID)
      })

      shareRoomsInfo(io)
    }

    socket.on(ACTIONS.RELAY_SDP, ({ peerID, sessionDescription }) => {
      io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
        peerID: socket.id,
        sessionDescription,
      })
    })

    socket.on(ACTIONS.RELAY_ICE, ({ peerID, iceCandidate }) => {
      io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
        peerID: socket.id,
        iceCandidate,
      })
    })

    socket.on(ACTIONS.LEAVE, leaveRoom)
    socket.on('disconnecting', leaveRoom)

    socket.on('joinedToCall', async (message) => {
      const user = await User.findById(message.userId)
      io.emit
    })
  })
}

module.exports = { setupSocketHandlers, onlineUsers }
