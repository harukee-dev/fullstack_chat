const jwt = require('jsonwebtoken')
const Message = require('./models/Message')
const { secret } = require('./config')
const User = require('./models/User')
const { io } = require('socket.io-client')
const Chat = require('./models/Chat')

// Множества пользователей
const typingUsers = new Set()
const onlineUsers = new Map()

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
  // Message.findByIdAndUpdate(_id, { isPinned: true })
  //   .then((pinnedMessage) => {
  //     if (pinnedMessage)
  //       io.to(pinnedMessage.chatId.toString()).emit(
  //         'messagePinned',
  //         pinnedMessage.populate('senderId', 'username avatar')
  //       )
  //     else console.error('Ошибка при закреплении сообщения')
  //   })
  //   .catch(console.error)
  try {
    const pinnedMessage = await Message.findByIdAndUpdate(_id, {
      isPinned: true,
    })
    if (!pinnedMessage) {
      console.log('!pinned message ERR')
      return
    }

    const populated = await pinnedMessage.populate(
      'senderId',
      'username avatar'
    )
    io.to(populated.chatId.toString()).emit('messagePinned', populated)
  } catch (e) {
    console.error(e)
  }
}

function handleUnpin(io, _id) {
  Message.findByIdAndUpdate(_id, { isPinned: false })
    .then((unpinnedMessage) => {
      if (unpinnedMessage) io.emit('messageUnpinned', unpinnedMessage)
      else console.error('Ошибка при откреплении сообщения')
    })
    .catch(console.error)
}

async function handleDelete(io, socket, _id) {
  try {
    const deletedMessage = await Message.findById(_id).lean()
    if (!deletedMessage) {
      socket.emit('error', { message: 'Message not found' })
      return
    }
    await Message.deleteOne({ _id })

    io.to(deletedMessage.chatId.toString()).emit(
      'messageDeleted',
      deletedMessage
    )
  } catch (e) {
    console.error(e)
  }
}

async function handleEdit(io, _id, text) {
  try {
    const updatedMessage = await Message.findByIdAndUpdate(
      _id,
      { text },
      { new: true }
    )
    if (updatedMessage && updatedMessage.chatId) {
      io.to(updatedMessage.chatId.toString()).emit(
        'messageEdited',
        updatedMessage
      )
    }
  } catch (e) {
    console.error(e)
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
  })
}

module.exports = { setupSocketHandlers, onlineUsers }
