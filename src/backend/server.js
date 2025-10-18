// Импорты и зависимости
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

// Конфигурация CORS
// const CLIENT_URL = 'http://localhost:3000' // клиент приложения, от которого мы принимаем запросы
const CLIENT_URL = 'http://185.207.64.7'

app.use(
  cors({
    origin: CLIENT_URL, // разрешаем запросы только с указанного домена
    credentials: true,
  })
)

const authRouter = require('./authRouter')
const mongoose = require('mongoose')

// Настройка Socket.IO сервера
const io = new Server(server, {
  cors: {
    origin: '*', // разрешаем подключение к socket с любых доменов
    methods: ['GET', 'POST'], // разрешенные HTTP методы
    allowedHeaders: ['Content-Type'], // разрешенные заголовки
    credentials: true, // разрешаем передачу cookies и авторизационных данных
  },
})

// Импорт обработчиков
const { setupSocketHandlers, initializeMediaSoup } = require('./socketHandler') // настройка обработчиков WebSocket событий, инициализация MediaSoup Workers

// Инициализация MediaSoup
async function initMediaSoup() {
  try {
    await initializeMediaSoup() // вызываем функцию инициализации
    console.log('Mediasoup workers initialized successfully') // логируем успешную инициализацию
  } catch (error) {
    // отладка ошибок
    console.error('Failed to initialize mediasoup workers:', error)
    process.exit(1) // при ошибке завершаем процесс
  }
}

// Middleware аутентификации для Socket.IO
io.use((socket, next) => {
  console.log('handshake:', socket.handshake)
  const token = socket.handshake.auth.token // достаем токен из socket
  // socket.handshake.auth - данные аутентификации, переданные клиентом при подключении
  if (!token) {
    // проверяем наличие токена
    return next(new Error('Нет токена'))
  }

  try {
    const decoded = jwt.verify(token, secret) // верифицируем JWT токен с помощью секретного ключа
    socket.user = decoded // сохраняем данные юзера в socket.user
    next() // вызываем next() для продолжения
  } catch (error) {
    // отладка ошибок
    console.log('Ошибка при аутентификации:', error)
  }
})

// Настройка express роутов
app.use(express.json()) // парсинг JSON тела запросов
app.use('/auth', authRouter) // роуты для аутентификации и переписок
app.use('/friends', friendsRouter(io)) // роуты для работы с друзьями

app.get('/', (request, response) => {
  // базовый роут для проверки работы сервера
  response.send('server')
})

// Конфигурация порта
const PORT = process.env.PORT || 10000

// Основная функция запуска сервера
async function start() {
  try {
    await mongoose.connect(
      'mongodb+srv://adminuser:adminpassword@cluster0.oh6fb.mongodb.net/chat'
    ) // подключение к MongoDB

    await initMediaSoup() // инициализация mediasoup (обязательно до настройки socket.io) - workers создаются и настраиваются на этом этапе

    setupSocketHandlers(io) // настройка socket.io обработчиков

    server.listen(PORT, () => {
      // запуск http сервера
      console.log(`Server running on port ${PORT}`) // логирование успешного запуска
    })
  } catch (err) {
    // отладка ошибок
    console.error(err)
  }
}

start()
