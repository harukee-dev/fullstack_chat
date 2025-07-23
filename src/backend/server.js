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

// const CLIENT_URL = 'http://localhost:3000'
const CLIENT_URL = 'https://omnio-web.netlify.app'

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

const { setupSocketHandlers } = require('./socketHandler')
setupSocketHandlers(io)

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
    server.listen(10000, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (err) {
    console.error(err)
  }
}

start()
