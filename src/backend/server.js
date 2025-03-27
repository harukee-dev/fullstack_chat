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

io.on('connection', (socket) => {
  socket.on('message', async (message) => {
    if (!message || !message.text) return

    const newMessage = new Message({
      username: socket.user.username,
      text: message.text,
    })

    console.log(newMessage)

    try {
      await newMessage.save()
      io.emit('message', {
        username: socket.user.username,
        text: message.text,
      })
    } catch (error) {
      console.error('Ошибка при сохранении сообщения:', error)
    }
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
    server.listen(5000, '0.0.0.0', () => {
      console.log('ADDRESS: http://95.174.112.204:5000')
    })
  } catch (err) {
    console.error(err)
  }
}

start()
