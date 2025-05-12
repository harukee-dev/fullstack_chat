const jwt = require('jsonwebtoken')
const Message = require('./models/Message')
const { secret } = require('./config')

// Множества пользователей
const typingUsers = new Set()
const onlineUsers = new Set()

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
function handleMessage(io, socket, message) {
  if (!message || !message.text) return

  const reply = {
    username: message.replyUser || null,
    text: message.replyText || null,
  }

  let newMessage = new Message({
    username: socket.user.username,
    text: message.text,
    timestamp: Date.now(),
    senderId: message.senderId,
  })

  if (reply.username && reply.text) {
    newMessage.replyMessage = reply
  }

  newMessage
    .save()
    .then(() => {
      io.emit('message', {
        _id: newMessage._id.toString(),
        username: socket.user.username,
        text: newMessage.text,
        timestamp: newMessage.timestamp,
        ...(reply.username && reply.text ? { replyMessage: reply } : {}),
      })
    })
    .catch((error) => {
      console.error('Ошибка при сохранении сообщения:', error)
    })
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

// Основная инициализация сокетов
function setupSocketHandlers(io) {
  io.use(authenticateSocket)

  io.on('connection', (socket) => {
    // Подключение пользователя
    onlineUsers.add(socket.user.username)
    io.emit('onlineUsers', Array.from(onlineUsers))

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
      typingUsers.delete(socket.user.username)
      onlineUsers.delete(socket.user.username)
      io.emit('onlineUsers', Array.from(onlineUsers))
      io.emit('usersTyping', Array.from(typingUsers))
    })
  })
}

module.exports = { setupSocketHandlers }
