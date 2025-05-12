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
      return res.status(404).json({ message: 'User not found' })
    }

    const existing = await Friendship.findOne({
      requesterId,
      recipientId: recipient._id,
    })
    if (existing) {
      return res.status(400).json({
        message: 'Request has already been sent',
      })
    }

    const friendship = new Friendship({
      requesterId,
      recipientId: recipient._id,
      status: 'pending',
    })

    await friendship.save()

    res.json({ message: 'Request sent!' })
  } catch (err) {
    console.error('Error sending request: ', err)
    res.status(500).json({ message: 'Server error' })
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
    console.error('Error fetching requests', error)
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/accept', async (req, res) => {
  const { requesterId, recipientId } = req.body

  try {
    await Friendship.findOneAndUpdate(
      { requesterId, recipientId, status: 'pending' },
      { status: 'accepted' }
    )

    res.json({ message: 'Accepted!' })
  } catch (error) {
    console.error('Application error')
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/decline', async (req, res) => {
  const { requesterId, recipientId } = req.body

  try {
    await Friendship.findOneAndDelete({
      requesterId,
      recipientId,
      status: 'pending',
    })

    res.json({ message: 'Request rejected' })
  } catch (error) {
    console.error('Reject error: ', error)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/list/:userId', async (req, res) => {
  const { userId } = req.params

  try {
    const friendships = await Friendship.find({
      $or: [
        { requesterId: userId, status: 'accepted' },
        { recipientId: userId, status: 'accepted' },
      ],
    })
      .populate('requesterId', 'username avatar')
      .populate('recipientId', 'username avatar')

    const friends = friendships.map((f) => {
      const friend =
        f.requesterId._id.toString() === userId ? f.recipientId : f.requesterId
      return {
        id: friend._id,
        username: friend.username,
        avatar: friend.avatar,
      }
    })

    res.json(friends)
  } catch (error) {
    console.error('Fetching friends error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
