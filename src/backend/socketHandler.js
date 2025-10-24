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
let mutedUsersByRooms = {}
const routers = new Map()
const transports = new Map()
let rooms = []
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

    // СОБЫТИЯ MEDIASOUP
    // Регистрируем медиа-обработчики ОДИН РАЗ на сокет
    if (!socket.data.mediaHandlersRegistered) {
      // если определенный сокет уже зарегистрирован, то мы не будем пересоздавать для него обработчики событий
      // Чтобы избежать выполнение одних и тех же действий и ненужной дополнительной нагрузки на сервер
      socket.data.mediaHandlersRegistered = true // выставляем, что сокет зарегистрировался

      // Обработка подключения транспорта
      socket.on(
        'connect-transport', // событие - клиент просит подключить транспорт
        async ({ transportId, dtlsParameters }, callback) => {
          // получаем айди транспорта для подключения и параметры шифрования DTLS
          try {
            console.log('Connecting transport:', transportId) // логируем начало подключения транспорта
            const transportData = transports.get(transportId) // находим транспорт по айди в мапе транспортов
            if (!transportData) {
              // логируем ошибку, если транспорт не найден
              throw new Error('Transport not found')
            }

            await transportData.transport.connect({ dtlsParameters }) // подключаем транспорт с заданными параметрами шифрования
            callback({ success: true }) // отправляем клиенту сообщение об успешном подключении к транспорту
          } catch (error) {
            // отладка ошибок
            console.error('Transport connect error:', error)
            callback({ success: false, error: error.message })
          }
        }
      )

      // Создание producer
      socket.on(
        'produce', // событие - клиент просит создать producer
        async (
          { transportId, kind, rtpParameters, roomId, appData },
          callback
        ) => {
          // принимает id транспорта, тип, rtp(протокол передачи медиа) параметры, и id комнаты
          try {
            console.log(
              'Creating producer:',
              kind,
              'for transport:',
              transportId
            ) // логируем начало создания producer
            const transportData = transports.get(transportId) // находим траспорт по айди в мапе транспортов
            if (!transportData || transportData.type !== 'send') {
              // логирование ошибки если транспорт не найден или не является транспортом отправки
              throw new Error('Send transport not found')
            }

            const producer = await transportData.transport.produce({
              // создаем producer на транспорте с заданными параметрами
              kind,
              rtpParameters,
              appData: appData || {},
            })

            const user = await User.findById(userId) // находим пользователя в БД по его id

            // сохраняем объект с самим продюсером, id комнаты, типом и данными и пользователе
            producers.set(producer.id, {
              producer,
              userId: socket.user.id,
              username: user.username,
              avatar: user.avatar,
              roomId,
              kind,
              appData: appData || {},
            })

            console.log(
              `Producer created: ${producer.id} for user ${socket.user.id}`
            ) // логирование успешного создания продюсера

            // уведомляем всем участником данной комнаты о новом продюсере
            socket.to(roomId).emit('new-producer', {
              producerId: producer.id,
              kind: producer.kind,
              userId: socket.user.id,
              username: user.username,
              avatar: user.avatar,
              appData: appData || {},
            })

            callback({
              success: true,
              producerId: producer.id,
            }) // возвращаем клиенту успешное создание продюсера и его id
          } catch (error) {
            // логирование ошибок при создании продюсера
            console.error('Produce error:', error)
            callback({ success: false, error: error.message })
          }
        }
      )

      socket.on('user-speaking', ({ userId, roomId }) => {
        socket.to(roomId).emit('user-speaking', userId)
      })

      socket.on('user-silent', ({ userId, roomId }) => {
        socket.to(roomId).emit('user-silent', userId)
      })

      // Создание consumer
      socket.on(
        'consume', // событие - клиент просит создать consumer
        async ({ transportId, producerId, rtpCapabilities }, callback) => {
          // получаем id транспорта и продюсера, также rtp (протокол передачи медиа данных)
          try {
            console.log('Creating consumer for producer:', producerId) // логирование начала создания consumer
            const transportData = transports.get(transportId) // находим нужный транспорт по его id
            const producerData = producers.get(producerId) // находим нужный producer по его id

            if (!transportData || transportData.type !== 'recv') {
              // если не нашли транспорт получения то логируем ошибку
              throw new Error('Receive transport not found')
            }
            if (!producerData) {
              // если не нашли продюсер то логируем ошибку
              throw new Error('Producer not found')
            }

            const router = await getOrCreateRouter(producerData.roomId) // создаем/получаем роутер (компонент, управляющий медиа потоками в комнате)

            // Проверяем, может ли router создать consumer
            if (
              !router.canConsume({
                // проверяет совместимость кодекод между producer и consumer
                producerId: producerId,
                rtpCapabilities: rtpCapabilities,
              })
            ) {
              throw new Error('Cannot consume this producer') // логирование ошибки
            }

            const consumer = await transportData.transport.consume({
              // создаем consumer с заданными параметрами
              producerId: producerId, // id продюсера, из которого мы создали consumer
              rtpCapabilities: rtpCapabilities, // протокол передачи медиа данных
              paused: false, // consumer сразу начинает получать медиа
            })

            callback({
              // возвращаем клиенту сообщение об успешном создании consumer и сам consumer
              success: true, // успешно
              consumerId: consumer.id, // id консюмера, который мы создали
              kind: consumer.kind, // тип (аудио или видео)
              rtpParameters: consumer.rtpParameters, // протокол передачи медиа данных
              producerId: producerId, // id продюсера, из которого мы сделали consumer
            })
          } catch (error) {
            // отладка ошибок при создании consumer
            console.error('Consume error:', error)
            callback({ success: false, error: error.message })
          }
        }
      )

      // Закрытие producer
      socket.on('producer-close', ({ producerId, roomId, appData }) => {
        // событие - клиент закрывает свой producer (для отправки медиа данных)
        try {
          const producerData = producers.get(producerId) // находим producer в мапе по его id
          if (producerData && producerData.userId === socket.user.id) {
            // если он есть и принадлежит пользователю
            producerData.producer.close() // закрываем producer
            producers.delete(producerId) // удаляем из мапа продюсеров

            socket
              .to(roomId)
              .emit('producer-close', { producerId, appData: appData || {} }) // уведомляем всех пользователей комнаты о закрытии producer
            console.log(`Producer ${producerId} closed`) // логируем успешное закрытие producer пользователя
          }
        } catch (error) {
          // отладка ошибок
          console.error('Error closing producer:', error)
        }
      })

      // Запрос существующих producers
      socket.on('get-producers', (roomId) => {
        // событие - новый участник комнаты запрашивает список существующих продюсеров
        try {
          const roomProducers = Array.from(producers.values()) // получаем из мапа продюсеров массив
            .filter((p) => p.roomId === roomId && p.userId !== socket.user.id) // фильтруем его по id комнаты, и убираем producers пользователя, который запросил все существующие
            .map((p) => ({
              // оставляем все продюсеры, прошедшие фильтрацию в таком виде
              producerId: p.producer.id, // id продюсера
              kind: p.kind, // тип (аудио или видео)
              userId: p.userId, // id юзера этого producer
              username: p.username, // ник юзера этого producer
              avatar: p.avatar, // аватар юзера этого producer
              appData: p.appData || {}, // если у продюсера kind === 'video', то внутри appData будет isScreenShare: boolean
            }))

          socket.emit('existing-producers', roomProducers) // возвращаем новому учатнику все существующие producers комнаты, в которую он вошел
        } catch (error) {
          // отладка ошибок
          console.error('Error getting producers:', error)
        }
      })

      // Создание новой комнаты - ОБРАБОТЧИК ДЛЯ ТЕСТОВОЙ ВЕРСИИ
      socket.on('new-room', (room) => {
        // событие - клиент создает новую комнату
        rooms.push(room)
        io.emit('new-room', room) // говорим всем остальным о том, что создалась новая комната
      })

      socket.on('get-rooms', () => {
        socket.emit('receive-rooms', rooms)
      })

      // Выход из комнаты
      socket.on('leave-room', ({ roomId }) => {
        // событие - участник покидает комнату
        try {
          console.log(`User ${socket.user.id} leaving room ${roomId}`) // логирование

          // закрываем все продюсеры пользователя в этой комнате
          for (const [producerId, data] of Array.from(producers.entries())) {
            // проходимся по всем producers
            if (data.userId === socket.user.id && data.roomId === roomId) {
              // если это producer нужного участника и он привязан к нужной комнате
              data.producer.close() // закрываем его
              producers.delete(producerId) // удаляем его из мапа producers
              socket.to(roomId).emit('producer-close', { producerId }) // возвращаем пользователю id продюсера, который закрыли
            }
          }

          // закрываем транспорты пользователя
          if (socket.transportIds) {
            // если у сокета пользователя есть транспорты
            for (const transportId of [
              // проходимся по всем транспортам (и отправки, и получения)
              socket.transportIds.send,
              socket.transportIds.recv,
            ]) {
              if (transportId) {
                // если у транспорта есть id
                const transportData = transports.get(transportId) // находим его в мапе
                if (transportData) {
                  // если мы его нашли
                  transportData.transport.close() // закрываем его
                  transports.delete(transportId) // удаляем его из мапа транспортов
                }
              }
            }
          }

          // удаляем пользователя из комнаты
          const users = roomUsers.get(roomId) // поулчаем всех users из нужной комнаты по ее id
          if (users) {
            // если нашли юзеров из нужной комнаты
            users.delete(socket.user.id) // удаляем из списка этих юзеров нашего, который выходит из комнаты
            if (users.size === 0) {
              // если он был единственным в комнате
              roomUsers.delete(roomId) // удаляем и саму комнату
              rooms = rooms.filter((el) => el.roomId !== roomId)
              io.emit('room-deleted', roomId)
              delete mutedUsersByRooms[roomId]
              const router = routers.get(roomId) // находим роутер этой комнаты
              if (router) {
                // если нашли - закрываем его и удаляем из мапа роутеров
                router.close()
                routers.delete(roomId)
              }
            }
          }

          socket.leave(roomId) // отписываемся от комнаты в сокете
          console.log(`User ${socket.user.id} left room ${roomId}`) // логируем
          io.to(roomId).emit('leave-from-room')
        } catch (error) {
          // отладка ошибок
          console.error('Error leaving room:', error)
        }
      })
    }

    // Присоединение к комнате
    socket.on('join-room', async ({ roomId }, callback) => {
      // событие - клиент просит подключить к комнате по ее id
      try {
        console.log(`User ${socket.user.id} joining room ${roomId}`) // логируем попытку входа

        if (!roomId) {
          // логируем ошибку, если такой комнаты нет
          throw new Error('Missing roomId')
        }

        const router = await getOrCreateRouter(roomId) // получаем роутер этой комнаты

        const sendTransport = await router.createWebRtcTransport({
          // создаем транспорт для отправки медиа данных с заданными параметрами
          listenIps: config.mediasoup.webRtcTransport.listenIps,
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 1000000,
        })

        const recvTransport = await router.createWebRtcTransport({
          // созданием транспорт для получения медиа данных с заданными параметрами
          listenIps: config.mediasoup.webRtcTransport.listenIps,
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        })

        // сохраняем транспорт отправки в Map с типом 'send'
        transports.set(sendTransport.id, {
          transport: sendTransport,
          type: 'send',
        })
        // и так же транспорт получения с типом 'recv' - сокращенно от receive
        transports.set(recvTransport.id, {
          transport: recvTransport,
          type: 'recv',
        })

        socket.transportIds = {
          // сохраняем в сокете данного пользователя id транспортов
          send: sendTransport.id,
          recv: recvTransport.id,
        }

        // создаем Map для комнаты, если не существует
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Map())
        }

        const user = await User.findById(userId) // находим пользователя из БД по его id

        roomUsers.get(roomId).set(socket.user.id, {
          // сохраняем информацию о пользователе и его транспортах в комнате
          socketId: socket.id, // id сокета
          username: user.username, // ник
          avatar: user.avatar, // аватар
          transports: [sendTransport.id, recvTransport.id], // транспорты (send,recv)
        })

        // отправляем параметры транспортов клиенту
        callback({
          success: true, // успешно
          transportOptions: {
            // транспорты
            send: {
              // транспорт отправки
              id: sendTransport.id, // id транспорта
              iceParameters: sendTransport.iceParameters, // ice параметры - для установления соединения через NAT
              iceCandidates: sendTransport.iceCandidates, // ICE кандидаты - все возможные пути соединения
              dtlsParameters: sendTransport.dtlsParameters, // DTLS параметры - для шифрования
            },
            recv: {
              // транспорт получения
              id: recvTransport.id, // id транспорта
              iceParameters: recvTransport.iceParameters, // ICE параметры - для установления соединения через NAT
              iceCandidates: recvTransport.iceCandidates, // ICE кандидаты - все возможные пути соединения
              dtlsParameters: recvTransport.dtlsParameters, // DTLS параметры - для шифрования
            },
          },
        })

        console.log(
          `Transports created for user ${socket.user.id} in room ${roomId}` // логируем успешное создание транспортов
        )

        // отправляем существующих producers новому пользователю
        const existingProducers = Array.from(producers.values()).filter(
          (p) => p.roomId === roomId && p.userId !== socket.user.id
        )

        if (existingProducers.length > 0) {
          // если они есть - отправляем их пользователю
          socket.emit(
            'existing-producers',
            existingProducers.map((p) => ({
              producerId: p.producer.id, // id продюсера
              kind: p.kind, // тип (аудио или видео)
              userId: p.userId, // id юзера данного продюсера
              username: p.username, // ник юзера данного продюсера
              avatar: p.avatar, // аватар юзера данного продюсера
              appData: p.appData || {}, // appData продюсера - если kind === 'video' то внутри даты будет isScreenShare: boolean
            }))
          )
        }

        socket.join(roomId) // присоединяем пользователя к комнате
        io.to(roomId).emit('joined-to-room')
        console.log(`User ${socket.user.id} successfully joined room ${roomId}`) // лоигурем
      } catch (error) {
        // отладка ошибок при присоединении пользователя к комнате
        console.error('Join room error:', error)
        callback({
          success: false,
          error: 'Failed to join room: ' + error.message,
        })
      }
    })

    socket.on('user-muted', (message) => {
      const { roomId, userId } = message

      if (!mutedUsersByRooms[roomId]) {
        mutedUsersByRooms[roomId] = new Set()
      }

      mutedUsersByRooms[roomId].add(userId)

      io.to(roomId).emit('user-muted', Array.from(mutedUsersByRooms[roomId]))
    })

    socket.on('user-unmuted', (message) => {
      const { roomId, userId } = message

      if (!mutedUsersByRooms[roomId]) {
        return
      }

      mutedUsersByRooms[roomId].delete(userId)

      io.to(roomId).emit('user-unmuted', Array.from(mutedUsersByRooms[roomId]))
    })

    socket.on('get-muted-users', (roomId) => {
      const mutedUsers = mutedUsersByRooms[roomId]
        ? Array.from(mutedUsersByRooms[roomId])
        : []
      socket.emit('get-muted-users', mutedUsers)
    })

    // Получение capabilities роутера(параметры передачи медиа данных) - какие кодеки, параметры и тп он поддерживает (для совместимости)
    socket.on('get-router-rtp-capabilities', async ({ roomId }, callback) => {
      try {
        const router = await getOrCreateRouter(roomId) // находим роутер нужной комнаты
        callback({
          rtpCapabilities: router.rtpCapabilities, // возвращаем его rtp
        })
      } catch (error) {
        // отладка ошибок
        console.error('Error getting router capabilities:', error)
        callback({ error: error.message })
      }
    })

    // обработка отключения
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id) // логирование

      // удаляем все tranports пользователя
      if (socket.transportIds) {
        // если у пользователя были транспорты
        for (const transportId of [
          // проходимся по каждому (и send и recv)
          socket.transportIds.send,
          socket.transportIds.recv,
        ]) {
          if (transportId) {
            // если он есть
            const transportData = transports.get(transportId) // находим его в мапе
            if (transportData) {
              // если нашли в мапе
              transportData.transport.close() // закрываем его
              transports.delete(transportId) // удаляем из мапа
            }
          }
        }
      }

      // удаляем все producers пользователя
      for (const [producerId, data] of Array.from(producers.entries())) {
        // проходимся по каждому producer на сервере
        if (data.userId === socket.user.id) {
          // если это producer нашего пользователя
          data.producer.close() // закрыаем его
          producers.delete(producerId) // удаляем из мапа
          socket.to(data.roomId).emit('producer-close', { producerId }) // уведомляем всех участников комнаты о закрытии producerы
        }
      }

      // удаляем пользователя из комнат
      for (const [roomId, users] of roomUsers.entries()) {
        // проходимся по всем комнатам и юзерам на сервере
        if (users.has(socket.user.id)) {
          // если нашли юзера в мапе юзеров
          users.delete(socket.user.id) // удаляем его из комнаты
          if (users.size === 0) {
            // если он был последним - удаляем комнату и роутер
            rooms = rooms.filter((room) => room.roomId !== roomId)
            io.emit('room-deleted', roomId)
            roomUsers.delete(roomId) // удаление комнаты
            const router = routers.get(roomId) // находим роутер комнаты
            if (router) {
              // если нашли его
              router.close() // закрываем его
              routers.delete(roomId) // удаляем
            }
          }
        }
      }

      // Очистка online users
      const socketsOfUser = onlineUsers.get(socket.user.id) // получаем всех пользователей c id сокета пользователя
      if (!socketsOfUser) return // если их нет - заканчиваем работу

      socketsOfUser.delete(socket.id) // удаляем из сокетов юзера

      if (socketsOfUser.size === 0) {
        // если это был последний сокет юзера (то есть больше ни на каких других устройствах с этого акканта сейчас не сидят)
        onlineUsers.delete(socket.user.id) // удаляем его из списка онлайн ползователей
        userSockets.delete(socket.user.id) // удаляем сокет из сокетов юзеров

        // уведомляем участников чатов, что пользователь оффлайн
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
