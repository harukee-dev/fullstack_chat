const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { secret } = require('./config')
const server = http.createServer(app)
const Message = require('./models/Message')
const friendsRouter = require('./routes/friends')
const path = require('path')
const mediasoup = require('mediasoup')
const config = require('./config')

const CLIENT_URL = 'http://localhost:3000'
// const CLIENT_URL = 'https://omnio-space.fun'

app.use(
  cors({
    origin: CLIENT_URL,
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

const { setupSocketHandlers, initializeMediaSoup } = require('./socketHandler')
const ACTIONS = require('./actions')

// Инициализация mediasoup ДО настройки сокетов
async function initMediaSoup() {
  try {
    await initializeMediaSoup()
    console.log('Mediasoup workers initialized successfully')
  } catch (error) {
    console.error('Failed to initialize mediasoup workers:', error)
    process.exit(1)
  }
}

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

app.use(express.json())
app.use('/auth', authRouter)
app.use('/friends', friendsRouter(io))

app.get('/', (request, response) => {
  response.send('server')
})

const PORT = process.env.PORT || 10000

async function start() {
  try {
    await mongoose.connect(
      'mongodb+srv://adminuser:adminpassword@cluster0.oh6fb.mongodb.net/chat'
    )

    // Инициализируем mediasoup перед запуском сервера
    await initMediaSoup()

    // Настраиваем обработчики сокетов после инициализации mediasoup
    setupSocketHandlers(io)

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (err) {
    console.error(err)
  }
}

start()
