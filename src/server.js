const express = require('express')
const app = express()
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())
app.use(express.json())

io.on('connection', (socket) => {
  socket.emit('message', 'Hello new user!')

  socket.on('message', (message) => {
    console.log(message)
    io.emit('message', message)
  })

  socket.on('disconnect', () => {
    io.emit('user has disconnect')
  })
})

app.get('/', (request, response) => {
  response.send('hello world!')
})

server.listen(10000, () => {
  console.log('ADDRESS: http://localhost:10000')
})
