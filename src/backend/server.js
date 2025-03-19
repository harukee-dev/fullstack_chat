const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const server = http.createServer(app)

const authRouter = require('./authRouter')

const mongoose = require('mongoose')

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())
app.use(express.json())
app.use('/auth', authRouter)

io.on('connection', (socket) => {
  socket.on('message', (message) => {
    if (!message || !message.name || !message.message) return

    console.log(`${message.name}: ${message.message}`)
    io.emit('message', `${message.name}: ${message.message}`)
  })

  socket.on('disconnect', () => {
    io.emit('message', 'A user has disconnected')
  })
})

app.get('/', (request, response) => {
  response.send('hello world!')
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
