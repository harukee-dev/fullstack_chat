// routes/friends.js
const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Friendship = require('../models/Friendship')

router.post('/send-request', async (req, res) => {
  try {
    const { requesterId, recipientUsername } = req.body

    const recipient = await User.findOne({ username: recipientUsername })
    if (!recipient) {
      return res.status(404).json({ message: 'Пользователь не найден' })
    }

    const existing = await Friendship.findOne({
      requesterId,
      recipientId: recipient._id,
    })
    if (existing) {
      return res.status(400).json({
        message: 'Заявка уже отправлена или пользователь уже в друзьях',
      })
    }

    const friendship = new Friendship({
      requesterId,
      recipientId: recipient._id,
      status: 'pending',
    })

    await friendship.save()

    res.json({ message: 'Заявка отправлена' })
  } catch (err) {
    console.error('Ошибка при отправке заявки:', err)
    res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
})

router.get('/requests/:userId', async (req, res) => {
  const userId = req.params.userId

  try {
    const requests = await Friendship.find({
      recipientId: userId,
      status: 'pending',
    }).populate('requesterId', 'username avatar')

    res.json(requests)
  } catch (error) {
    console.error('Ошибка при получении заявок:', error)
    res.status(500).json({ message: 'Ошибка сервера' })
  }
})

module.exports = router
