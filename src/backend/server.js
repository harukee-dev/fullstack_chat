const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { secret } = require('./config')
const server = http.createServer(app)
const Message = require('./models/Message')

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

io.on('connection', (socket) => {
  socket.on('message', async (message) => {
    if (!message || !message.text) return

    const newMessage = new Message({
      username: socket.user.username,
      text: message.text,
      timestamp: Date.now(),
    })

    console.log(newMessage)

    try {
      await newMessage.save()
      io.emit('message', {
        username: socket.user.username,
        text: message.text,
        timestamp: newMessage.timestamp,
      })
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

  socket.on('disconnect', () => {
    typingUsers.delete(socket.user.username)
    io.emit('usersTyping', Array.from(typingUsers))
  })
})

app.use(cors())
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
