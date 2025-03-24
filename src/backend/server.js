const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { secret } = require('./config')
const server = http.createServer(app)

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
  const token = socket.handshake.auth.token // токен теперь приходит через auth
  if (!token) {
    console.log('Нет токена')
    return next(new Error('Нет токена'))
  }

  try {
    const decoded = jwt.verify(token, secret)
    console.log('Пользователь аутентифицирован:', decoded)
    socket.user = decoded
    next()
  } catch (error) {
    console.log('Ошибка при аутентификации:', error)
    return next(new Error('Неверный или истекший токен'))
  }
})

io.on('connection', (socket) => {
  console.log(`Пользователь ${socket.user.username} подключился`)

  socket.on('message', (message) => {
    if (!message || !message.message) return

    console.log(`${socket.user.username}: ${message.message}`)
    io.emit('message', `${socket.user.username}: ${message.message}`)
  })

  socket.on('disconnect', () => {
    console.log(`Пользователь ${socket.user.username} отключился`)
  })
})

app.use(cors())
app.use(express.json())
app.use('/auth', authRouter)

app.get('/', (request, response) => {
  response.send('server')
})

async function start() {
  try {
    await mongoose.connect(
      'mongodb+srv://adminuser:adminpassword@cluster0.oh6fb.mongodb.net/chat'
    )
    server.listen(10000, () => {
      console.log('ADDRESS: http://localhost:10000')
    })
  } catch (err) {
    console.error(err)
  }
}

start()
