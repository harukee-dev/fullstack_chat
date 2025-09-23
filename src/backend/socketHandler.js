const jwt = require('jsonwebtoken')
const Message = require('./models/Message')
const { secret } = require('./config')
const User = require('./models/User')
const Chat = require('./models/Chat')
const ACTIONS = require('./actions')
const { version, validate } = require('uuid')
const mediasoup = require('mediasoup')
const { config } = require('./config')

// Глобальные переменные для медиасервера
let workers = []
let nextMediasoupWorkerIdx = 0
const routers = new Map()
const transports = new Map()
const producers = new Map()
const roomUsers = new Map()

// Множества пользователей
const typingUsers = new Set()
const onlineUsers = new Map()

// Инициализация mediasoup workers
async function initializeMediaSoup() {
  try {
    console.log('Initializing mediasoup workers...')

    // Создаем workers по количеству ядер
    const numWorkers = config.mediasoup.numWorkers || 1

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      })

      worker.on('died', () => {
        console.error('Mediasoup worker died, exiting...')
        process.exit(1)
      })

      workers.push(worker)
      console.log(`Mediasoup worker ${i + 1} created (PID: ${worker.pid})`)
    }

    console.log(`Total ${workers.length} mediasoup workers created`)
    return workers
  } catch (error) {
    console.error('Failed to create mediasoup workers:', error)
    throw error
  }
}

// Получение следующего worker по round-robin
function getNextWorker() {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available')
  }

  const worker = workers[nextMediasoupWorkerIdx]
  nextMediasoupWorkerIdx = (nextMediasoupWorkerIdx + 1) % workers.length
  return worker
}

// Получение или создание router для комнаты
async function getOrCreateRouter(roomId) {
  let router = routers.get(roomId)
  if (!router) {
    const worker = getNextWorker()

    // Используем codecs из конфига
    const mediaCodecs = config.mediasoup.router.mediaCodecs

    router = await worker.createRouter({ mediaCodecs })
    routers.set(roomId, router)
    console.log(`Created router for room ${roomId} on worker ${worker.pid}`)
  }
  return router
}

// ... остальной код socketHandler.js остается без изменений ...

function getClientRooms(io) {
  const { rooms } = io.sockets.adapter

  return Array.from(rooms.keys()).filter(
    (roomID) => validate(roomID) && version(roomID) === 4
  )
}

function shareRoomsInfo(io) {
  io.emit(ACTIONS.SHARE_ROOMS, { rooms: getClientRooms(io) })
}

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
    next(new Error('Invalid token'))
  }
}

// Обработчики событий (сохранены ваши оригинальные функции)
async function handleMessage(io, socket, message) {
  if (!message || !message.text || !message.chatId) return

  const reply = {
    username: message.replyUser || null,
    text: message.replyText || null,
  }

  const newMessageData = {
    text: message.text,
    timestamp: Date.now(),
    senderId: message.senderId,
    chatId: message.chatId,
  }

  if (reply.username && reply.text) {
    newMessageData.replyMessage = reply
  }

  try {
    const newMessage = new Message(newMessageData)
    const savedMessage = await newMessage.save()

    const populatedMessage = await savedMessage.populate(
      'senderId',
      'username avatar'
    )

    const currentChat = await Chat.findByIdAndUpdate(
      populatedMessage.chatId,
      {
        updatedAt: Date.now(),
      },
      { new: true }
    )

    const currentChatMembers = currentChat.members

    const emittedMessage = {
      _id: populatedMessage._id.toString(),
      text: populatedMessage.text,
      timestamp: populatedMessage.timestamp,
      chatId: message.chatId,
      senderId: {
        _id: populatedMessage.senderId._id,
        username: populatedMessage.senderId.username,
        avatar: populatedMessage.senderId.avatar,
      },
      ...(reply.username && reply.text && { replyMessage: reply }),
    }

    io.to(message.chatId).emit('message', emittedMessage)
    currentChatMembers.forEach((member) => {
      io.to(member.toString()).emit('chatUpdated', {
        id: currentChat._id,
        updatedAt: currentChat.updatedAt,
      })
      if (member._id !== emittedMessage.senderId._id)
        io.to(member.toString()).emit('new-message', emittedMessage)
    })
  } catch (error) {
    console.error('Ошибка при сохранении сообщения:', error)
  }
}

async function handlePin(io, _id) {
  try {
    const pinnedMessage = await Message.findByIdAndUpdate(
      _id,
      { isPinned: true },
      { new: true }
    )

    if (!pinnedMessage) {
      console.log('!pinned message ERR')
      return
    }

    const populated = await pinnedMessage.populate(
      'senderId',
      'username avatar'
    )

    const chat = await Chat.findById(pinnedMessage.chatId).lean()
    if (!chat || !chat.members) {
      console.log('Chat not found or has no members')
      return
    }

    io.to(populated.chatId.toString()).emit('messagePinned', populated)

    chat.members.forEach((memberId) => {
      if (memberId.toString() !== populated.senderId._id.toString()) {
        io.to(memberId.toString()).emit('new-pinned', populated)
      }
    })
  } catch (e) {
    console.error('Error in handlePin:', e)
  }
}

async function handleUnpin(io, _id) {
  try {
    const unpinnedMessage = await Message.findByIdAndUpdate(
      _id,
      { isPinned: false },
      { new: true }
    )

    if (!unpinnedMessage) {
      console.error('Ошибка при откреплении сообщения')
      return
    }

    const populated = await unpinnedMessage.populate(
      'senderId',
      'username avatar'
    )

    const chat = await Chat.findById(populated.chatId).lean()
    if (!chat || !chat.members) {
      console.error('Чат не найден или не содержит участников')
      return
    }

    io.to(populated.chatId.toString()).emit('messageUnpinned', populated)

    chat.members.forEach((memberId) => {
      if (memberId.toString() !== populated.senderId._id.toString()) {
        io.to(memberId.toString()).emit('new-unpin', populated)
      }
    })
  } catch (error) {
    console.error('Ошибка в handleUnpin:', error)
  }
}

async function handleDelete(io, socket, _id) {
  try {
    const deletedMessage = await Message.findById(_id).lean()
    if (!deletedMessage) {
      socket.emit('error', { message: 'Message not found' })
      return
    }

    await Message.deleteOne({ _id })

    const chat = await Chat.findById(deletedMessage.chatId).lean()
    if (!chat || !chat.members) {
      console.error('Чат не найден или не содержит участников')
      return
    }

    io.to(deletedMessage.chatId.toString()).emit(
      'messageDeleted',
      deletedMessage
    )

    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit('new-delete', deletedMessage)
    })
  } catch (e) {
    console.error('Ошибка при удалении сообщения:', e)
    socket.emit('error', { message: 'Failed to delete message' })
  }
}

async function handleEdit(io, _id, text) {
  try {
    const updatedMessage = await Message.findByIdAndUpdate(
      _id,
      { text },
      { new: true }
    )
      .populate('senderId', 'username avatar')
      .lean()

    if (!updatedMessage || !updatedMessage.chatId) {
      console.error('Сообщение не найдено или нет chatId')
      return
    }

    const chat = await Chat.findById(updatedMessage.chatId).lean()
    if (!chat || !chat.members) {
      console.error('Чат не найден или не содержит участников')
      return
    }

    io.to(updatedMessage.chatId.toString()).emit(
      'messageEdited',
      updatedMessage
    )

    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit('new-edit', updatedMessage)
    })
  } catch (e) {
    console.error('Ошибка при изменении сообщения:', e)
  }
}

const userSockets = new Map()

// Основная инициализация сокетов
function setupSocketHandlers(io) {
  io.use(authenticateSocket)

  io.on('connection', async (socket) => {
    shareRoomsInfo(io)
    const userId = socket.user.id
    userSockets.set(userId.toString(), socket.id)
    socket.join(userId.toString())

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set())
    }

    onlineUsers.get(userId).add(socket.id)

    // Объявляем один раз в скоупе коннекта
    const chatParticipants = new Set()

    try {
      const user = await User.findById(userId).select('userChats')
      if (!user) return

      const chats = await Chat.find({ _id: { $in: user.userChats } }).select(
        'members'
      )

      chats.forEach((chat) => {
        chat.members.forEach((memberId) => {
          const id = memberId.toString()
          if (id !== userId) {
            chatParticipants.add(id)
          }
        })
      })

      for (const participantId of chatParticipants) {
        const sockets = onlineUsers.get(participantId)
        if (sockets) {
          sockets.forEach((sockId) => {
            io.to(sockId).emit('user-online', userId)
          })
        }
      }
    } catch (error) {
      console.error('Ошибка при получении участников чатов:', error)
    }

    try {
      const user = await User.findById(userId).select('userChats')
      if (!user) return

      const chats = await Chat.find({ _id: { $in: user.userChats } }).select(
        'members'
      )

      const participantIds = new Set()
      chats.forEach((chat) => {
        chat.members.forEach((memberId) => {
          const id = memberId.toString()
          if (id !== userId && onlineUsers.has(id)) {
            participantIds.add(id)
          }
        })
      })

      socket.emit('onlineChatUsersList', Array.from(participantIds))
    } catch (err) {
      console.error('Ошибка в getOnlineChatUsers:', err)
    }

    socket.on('joinChatRoom', (chatId) => {
      if (!chatId) return
      socket.join(chatId)
    })

    console.log('Socket handler initialized for:', socket.id)

    socket.on('sendFriendDeleted', ({ user1, user2 }) => {
      io.to(user1.toString()).emit('friendshipDeleted', { user1, user2 })
      io.to(user2.toString()).emit('friendshipDeleted', { user1, user2 })
    })

    socket.on('addedFriendship', async ({ user1, user2 }) => {
      try {
        const [userOne, userTwo] = await Promise.all([
          User.findById(user1.toString()).select('username avatar'),
          User.findById(user2.toString()).select('username avatar'),
        ])

        if (userOne && userTwo) {
          io.to(user1.toString()).emit('friendAdded', {
            id: userTwo._id,
            username: userTwo.username,
            avatar: userTwo.avatar,
          })

          io.to(user2.toString()).emit('friendAdded', {
            id: userOne._id,
            username: userOne.username,
            avatar: userOne.avatar,
          })
        }
      } catch (err) {
        console.error('Ошибка при отправке friendAdded:', err)
      }
    })

    socket.on('newRequest', async ({ requesterId, recipientUsername }) => {
      const requester = await User.findOne({ _id: requesterId })
      const recipient = await User.findOne({ username: recipientUsername })
      if (!recipient || !requester) return
      io.to(recipient._id.toString()).emit('newRequest', {
        avatar: requester.avatar,
        id: requesterId,
        username: requester.username,
      })
    })

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

    socket.on('friendshipDeleted', async ({ user1, user2 }) => {
      console.log('friendshipDeleted socket server', user1, user2)
      io.to(user1.toString(), user2.toString()).emit('friendshipDeleted', {
        user1,
        user2,
      })
    })

    // Mediasoup обработчики
    // В обработчике join-room, после создания send transport, добавить создание receive transport
    socket.on('join-room', async ({ roomId, userId }, callback) => {
      try {
        console.log(`User ${userId} joining room ${roomId}`)

        if (!roomId || !userId) {
          throw new Error('Missing roomId or userId')
        }

        const router = await getOrCreateRouter(roomId)

        // Создаем SEND транспорт для пользователя (для отправки медиа)
        const sendTransport = await router.createWebRtcTransport({
          listenIps: config.mediasoup.webRtcTransport.listenIps,
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 1000000,
        })

        // Создаем RECEIVE транспорт для пользователя (для приема медиа)
        const recvTransport = await router.createWebRtcTransport({
          listenIps: config.mediasoup.webRtcTransport.listenIps,
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        })

        // Сохраняем транспорты
        transports.set(sendTransport.id, {
          transport: sendTransport,
          type: 'send',
        })
        transports.set(recvTransport.id, {
          transport: recvTransport,
          type: 'recv',
        })

        socket.transportIds = {
          send: sendTransport.id,
          recv: recvTransport.id,
        }

        // Сохраняем информацию о пользователе в комнате
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Map())
        }
        roomUsers.get(roomId).set(userId, {
          socketId: socket.id,
          transports: [sendTransport.id, recvTransport.id],
        })

        // Отправляем параметры транспортов клиенту
        callback({
          success: true,
          transportOptions: {
            send: {
              id: sendTransport.id,
              iceParameters: sendTransport.iceParameters,
              iceCandidates: sendTransport.iceCandidates,
              dtlsParameters: sendTransport.dtlsParameters,
            },
            recv: {
              id: recvTransport.id,
              iceParameters: recvTransport.iceParameters,
              iceCandidates: recvTransport.iceCandidates,
              dtlsParameters: recvTransport.dtlsParameters,
            },
          },
        })

        console.log(`Transports created for user ${userId} in room ${roomId}`)

        // Отправляем существующих producers новому пользователю
        const existingProducers = Array.from(producers.values()).filter(
          (p) => p.roomId === roomId && p.userId !== userId
        )

        if (existingProducers.length > 0) {
          // Отправляем сразу, без задержки
          socket.emit(
            'existing-producers',
            existingProducers.map((p) => ({
              producerId: p.producer.id,
              kind: p.kind,
              userId: p.userId,
            }))
          )
        }

        // Обработка подключения транспорта (общая для send и recv)
        socket.on(
          'connect-transport',
          async ({ transportId, dtlsParameters }, callback) => {
            try {
              console.log('Connecting transport:', transportId)
              const transportData = transports.get(transportId)
              if (!transportData) {
                throw new Error('Transport not found')
              }

              await transportData.transport.connect({ dtlsParameters })
              callback({ success: true })
            } catch (error) {
              console.error('Transport connect error:', error)
              callback({ success: false, error: error.message })
            }
          }
        )

        // Создание producer (только на send transport)
        socket.on(
          'produce',
          async ({ transportId, kind, rtpParameters }, callback) => {
            try {
              console.log(
                'Creating producer:',
                kind,
                'for transport:',
                transportId
              )
              const transportData = transports.get(transportId)
              if (!transportData || transportData.type !== 'send') {
                throw new Error('Send transport not found')
              }

              const producer = await transportData.transport.produce({
                kind,
                rtpParameters,
              })

              // Сохраняем producer
              producers.set(producer.id, {
                producer,
                userId,
                roomId,
                kind,
              })

              console.log(`Producer created: ${producer.id} for user ${userId}`)

              // Уведомляем всех в комнате о новом producer
              socket.to(roomId).emit('new-producer', {
                producerId: producer.id,
                kind: producer.kind,
                userId: userId,
              })

              callback({
                success: true,
                producerId: producer.id,
              })
            } catch (error) {
              console.error('Produce error:', error)
              callback({ success: false, error: error.message })
            }
          }
        )

        // Создание consumer (только на recv transport)
        socket.on(
          'consume',
          async ({ transportId, producerId, rtpCapabilities }, callback) => {
            try {
              console.log('Creating consumer for producer:', producerId)
              const transportData = transports.get(transportId)
              const producerData = producers.get(producerId)

              if (!transportData || transportData.type !== 'recv') {
                throw new Error('Receive transport not found')
              }
              if (!producerData) {
                throw new Error('Producer not found')
              }

              // Проверяем, может ли router создать consumer
              if (
                !router.canConsume({
                  producerId: producerId,
                  rtpCapabilities: rtpCapabilities,
                })
              ) {
                throw new Error('Cannot consume this producer')
              }

              const consumer = await transportData.transport.consume({
                producerId: producerId,
                rtpCapabilities: rtpCapabilities,
                paused: false,
              })

              callback({
                success: true,
                consumerId: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerId: producerId,
              })
            } catch (error) {
              console.error('Consume error:', error)
              callback({ success: false, error: error.message })
            }
          }
        )

        // Присоединяем к комнате
        socket.join(roomId)
        console.log(`User ${userId} successfully joined room ${roomId}`)
      } catch (error) {
        console.error('Join room error:', error)
        callback({
          success: false,
          error: 'Failed to join room: ' + error.message,
        })
      }
    })

    // Получение capabilities роутера
    socket.on('get-router-rtp-capabilities', async ({ roomId }, callback) => {
      try {
        const router = await getOrCreateRouter(roomId)
        callback({
          rtpCapabilities: router.rtpCapabilities,
        })
      } catch (error) {
        console.error('Error getting router capabilities:', error)
        callback({ error: error.message })
      }
    })

    // Закрытие producer
    socket.on('producer-close', ({ producerId, roomId }) => {
      try {
        const producerData = producers.get(producerId)
        if (producerData) {
          producerData.producer.close()
          producers.delete(producerId)

          // Уведомляем всех в комнате
          socket.to(roomId).emit('producer-close', { producerId })
          console.log(`Producer ${producerId} closed`)
        }
      } catch (error) {
        console.error('Error closing producer:', error)
      }
    })

    // Запрос существующих producers
    socket.on('get-producers', (roomId) => {
      try {
        const roomProducers = Array.from(producers.values())
          .filter((p) => p.roomId === roomId && p.userId !== socket.user.id)
          .map((p) => ({
            producerId: p.producer.id,
            kind: p.kind,
            userId: p.userId,
          }))

        socket.emit('existing-producers', roomProducers)
      } catch (error) {
        console.error('Error getting producers:', error)
      }
    })

    // Обработка отключения
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)

      // Закрываем все transports пользователя
      if (socket.transportId) {
        const transport = transports.get(socket.transportId)
        if (transport) {
          transport.close()
          transports.delete(socket.transportId)
        }
      }

      // Удаляем все producers пользователя
      const userProducers = Array.from(producers.entries()).filter(
        ([_, data]) => data.userId === socket.user.id
      )

      userProducers.forEach(([producerId, data]) => {
        data.producer.close()
        producers.delete(producerId)
        // Уведомляем комнату о закрытии producer
        socket.to(data.roomId).emit('producer-close', { producerId })
      })

      // Удаляем пользователя из комнат
      for (const [roomId, users] of roomUsers.entries()) {
        if (users.has(socket.user.id)) {
          users.delete(socket.user.id)
          if (users.size === 0) {
            roomUsers.delete(roomId)
            // Удаляем router если комната пуста
            const router = routers.get(roomId)
            if (router) {
              router.close()
              routers.delete(roomId)
            }
          }
        }
      }

      // Очистка online users
      const socketsOfUser = onlineUsers.get(socket.user.id)
      if (!socketsOfUser) return

      socketsOfUser.delete(socket.id)

      if (socketsOfUser.size === 0) {
        onlineUsers.delete(socket.user.id)
        userSockets.delete(socket.user.id)

        // Уведомляем участников чатов, что пользователь оффлайн
        chatParticipants.forEach((participantId) => {
          io.to(participantId).emit('user-offline', { userId: socket.user.id })
        })
      }
    })
  })
}

module.exports = {
  setupSocketHandlers,
  initializeMediaSoup,
  onlineUsers,
}
