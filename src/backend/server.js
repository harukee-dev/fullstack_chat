const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { secret } = require('./config')
const server = http.createServer(app)
const Message = require('./models/Message')

// const CLIENT_URL = 'http://localhost:3000'
// const CLIENT_URL = 'https://harukee.netlify.app'

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
)

const authRouter = require('./authRouter')

const mongoose = require('mongoose')

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
})

io.use((socket, next) => {
  console.log('handshake:', socket.handshake)
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error('Нет токена'))
  }

  try {
    const decoded = jwt.verify(token, secret)
    socket.user = decoded
    next()
  } catch (error) {
    console.log('Ошибка при аутентификации:', error)
  }
})

const typingUsers = new Set()
const onlineUsers = new Set()

io.on('connection', (socket) => {
  onlineUsers.add(socket.user.username)
  io.emit('onlineUsers', Array.from(onlineUsers))

  socket.on('message', async (message) => {
    if (!message || !message.text) return

    const reply = {
      username: message.replyUser || null,
      text: message.replyText || null,
    }

    let newMessage = new Message({
      username: socket.user.username,
      text: message.text,
      timestamp: Date.now(),
    })

    if (reply.username !== null && reply.text !== null) {
      newMessage = new Message({
        username: socket.user.username,
        text: message.text,
        timestamp: Date.now(),
        replyMessage: { username: reply.username, text: reply.text },
      })
    }

    console.log(newMessage)

    try {
      await newMessage.save()
      if (reply.username !== null && reply.text !== null) {
        io.emit('message', {
          _id: newMessage._id.toString(), // <--- добавляем id как строку
          username: socket.user.username,
          text: newMessage.text,
          timestamp: newMessage.timestamp,
          replyMessage: { username: reply.username, text: reply.text },
        })
      } else {
        io.emit('message', {
          _id: newMessage._id.toString(), // <--- добавляем id как строку
          username: socket.user.username,
          text: newMessage.text,
          timestamp: newMessage.timestamp,
        })
      }
    } catch (error) {
      console.error('Ошибка при сохранении сообщения:', error)
    }
  })

  socket.on('typing', () => {
    typingUsers.add(socket.user.username)
    socket.broadcast.emit('usersTyping', Array.from(typingUsers))
  })

  socket.on('stopTyping', () => {
    typingUsers.delete(socket.user.username)
    socket.broadcast.emit('usersTyping', Array.from(typingUsers))
  })

  socket.on('newPin', async ({ _id }) => {
    try {
      const pinnedMessage = await Message.findByIdAndUpdate(_id, {
        isPinned: true,
      })
      if (pinnedMessage) {
        io.emit('messagePinned', pinnedMessage)
      } else {
        console.error('ошибка при закреплении сообщения')
      }
    } catch (e) {
      console.error(e)
    }
  })

  socket.on('unpin', async ({ _id }) => {
    try {
      const unpinnedMessage = await Message.findByIdAndUpdate(_id, {
        isPinned: false,
      })
      if (unpinnedMessage) {
        io.emit('messageUnpinned', unpinnedMessage)
      } else {
        console.error('ошибка при закреплении сообщения')
      }
    } catch (e) {
      console.error(e)
    }
  })

  socket.on('deleteMessage', async ({ _id }) => {
    try {
      const deletedMessage = await Message.findByIdAndDelete(_id)

      if (!deletedMessage) {
        socket.emit('error', { message: 'Message not found' })
        return
      }

      socket.broadcast.emit('messageDeleted', { _id })

      socket.emit('messageDeleted', { _id })
    } catch (error) {
      console.error('Error deleting message:', error)
      socket.emit('error', { message: 'Failed to delete message' })
    }
  })

  socket.on('disconnect', () => {
    typingUsers.delete(socket.user.username)
    onlineUsers.delete(socket.user.username)
    io.emit('onlineUsers', Array.from(onlineUsers))
    io.emit('usersTyping', Array.from(typingUsers))
  })
  socket.on('editMessage', async ({ _id, text }) => {
    try {
      const updatedMessage = await Message.findByIdAndUpdate(
        _id,
        { text },
        { new: true }
      )

      if (updatedMessage) {
        // Рассылаем всем клиентам
        io.emit('messageEdited', updatedMessage)
      }
    } catch (error) {
      console.error('Ошибка при редактировании сообщения:', error)
    }
  })
})
app.use(express.json())
app.use('/auth', authRouter)

app.get('/', (request, response) => {
  response.send('server')
})

const PORT = process.env.PORT || 10000

async function start() {
  try {
    await mongoose.connect(
      'mongodb+srv://adminuser:adminpassword@cluster0.oh6fb.mongodb.net/chat'
    )
    server.listen(10000, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (err) {
    console.error(err)
  }
}

start()
