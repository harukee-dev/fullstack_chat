const jwt = require('jsonwebtoken')
const Message = require('./models/Message')
const { secret } = require('./config')
const Friendship = require('./models/Friendship')
const User = require('./models/User')

// Множества пользователей
const typingUsers = new Set()
export const onlineUsers = new Map()

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
  if (!message || !message.text) return

  const reply = {
    username: message.replyUser || null,
    text: message.replyText || null,
  }

  const newMessageData = {
    text: message.text,
    timestamp: Date.now(),
    senderId: message.senderId, // должен быть ObjectId
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

    const emittedMessage = {
      _id: populatedMessage._id.toString(),
      text: populatedMessage.text,
      timestamp: populatedMessage.timestamp,
      senderId: {
        _id: populatedMessage.senderId._id,
        username: populatedMessage.senderId.username,
        avatar: populatedMessage.senderId.avatar,
      },
      ...(reply.username && reply.text && { replyMessage: reply }),
    }

    io.emit('message', emittedMessage)
  } catch (error) {
    console.error('Ошибка при сохранении сообщения:', error)
  }
}

function handlePin(io, _id) {
  Message.findByIdAndUpdate(_id, { isPinned: true })
    .then((pinnedMessage) => {
      if (pinnedMessage) io.emit('messagePinned', pinnedMessage)
      else console.error('Ошибка при закреплении сообщения')
    })
    .catch(console.error)
}

function handleUnpin(io, _id) {
  Message.findByIdAndUpdate(_id, { isPinned: false })
    .then((unpinnedMessage) => {
      if (unpinnedMessage) io.emit('messageUnpinned', unpinnedMessage)
      else console.error('Ошибка при откреплении сообщения')
    })
    .catch(console.error)
}

function handleDelete(io, socket, _id) {
  Message.findByIdAndDelete(_id)
    .then((deleted) => {
      if (!deleted) {
        socket.emit('error', { message: 'Message not found' })
        return
      }
      io.emit('messageDeleted', { _id })
    })
    .catch((error) => {
      console.error('Error deleting message:', error)
      socket.emit('error', { message: 'Failed to delete message' })
    })
}

function handleEdit(io, _id, text) {
  Message.findByIdAndUpdate(_id, { text }, { new: true })
    .then((updated) => {
      if (updated) io.emit('messageEdited', updated)
    })
    .catch((error) => {
      console.error('Ошибка при редактировании сообщения:', error)
    })
}

const userSockets = new Map()

// Основная инициализация сокетов
function setupSocketHandlers(io) {
  io.use(authenticateSocket)

  io.on('connection', (socket) => {
    const userId = socket.user.id
    userSockets.set(userId.toString(), socket.id)
    onlineUsers.set(socket.user.username, socket.id)
    io.emit('onlineUsers', Array.from(onlineUsers.keys()))

    socket.on('joinPersonalRoom', (userId) => {
      socket.join(userId)
    })

    socket.on('sendFriendDeleted', ({ user1, user2 }) => {
      io.to(user1).emit('friendshipDeleted', { user1, user2 })
      io.to(user2).emit('friendshipDeleted', { user1, user2 })
    })

    socket.on('addedFriendship', async ({ user1, user2 }) => {
      try {
        const [userOne, userTwo] = await Promise.all([
          User.findById(user1).select('username avatar'),
          User.findById(user2).select('username avatar'),
        ])

        if (userOne && userTwo) {
          // Отправляем каждому информацию о другом
          io.to(user1).emit('friendAdded', {
            id: userTwo._id,
            username: userTwo.username,
            avatar: userTwo.avatar,
          })

          io.to(user2).emit('friendAdded', {
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

    // Статус печатания
    socket.on('typing', () => {
      typingUsers.add(socket.user.username)
      socket.broadcast.emit('usersTyping', Array.from(typingUsers))
    })
    socket.on('stopTyping', () => {
      typingUsers.delete(socket.user.username)
      socket.broadcast.emit('usersTyping', Array.from(typingUsers))
    })

    // Отключение
    socket.on('disconnect', () => {
      userSockets.delete(userId.toString())
      typingUsers.delete(socket.user.username)
      onlineUsers.delete(socket.user.username)
      io.emit('onlineUsers', Array.from(onlineUsers.keys()))
      io.emit('usersTyping', Array.from(typingUsers))
    })
  })
}

module.exports = { setupSocketHandlers }
