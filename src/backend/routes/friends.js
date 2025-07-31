module.exports = function (io) {
  const express = require('express')
  const router = express.Router()
  const User = require('../models/User')
  const Friendship = require('../models/Friendship')
  const Chat = require('../models/Chat')
  const { onlineUsers } = require('../socketHandler')

  router.post('/send-request', async (req, res) => {
    try {
      const { requesterId, recipientUsername } = req.body

      const recipient = await User.findOne({ username: recipientUsername })
      if (!recipient) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (recipient._id.toString() === requesterId.toString()) {
        return res.status(400).json({
          message: "You can't send a request to yourself",
        })
      }

      const existing = await Friendship.findOne({
        $or: [
          { requesterId, recipientId: recipient._id },
          { requesterId: recipient._id, recipientId: requesterId },
        ],
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
      let chat = await Chat.findOne({
        type: 'private',
        members: { $all: [requesterId, recipientId], $size: 2 },
      })

      if (!chat) {
        chat = await Chat.create({
          type: 'private',
          members: [recipientId, requesterId],
        })
      }

      await Friendship.findOneAndUpdate(
        { requesterId, recipientId, status: 'pending' },
        { status: 'accepted' }
      )

      await Promise.all([
        User.findByIdAndUpdate(requesterId, {
          $addToSet: { userChats: chat._id },
        }),
        User.findByIdAndUpdate(recipientId, {
          $addToSet: { userChats: chat._id },
        }),
      ])

      const fullChat = await Chat.findById(chat._id)
        .populate('members', '_id username avatar online')
        .lean()

      const onlineStatusForRequester = onlineUsers.has(recipientId.toString())
        ? recipientId
        : null
      const onlineStatusForRecipient = onlineUsers.has(requesterId.toString())
        ? requesterId
        : null

      io.to(requesterId).emit('new-private-chat', {
        chat: fullChat,
        isOnline: onlineStatusForRequester,
      })

      io.to(recipientId).emit('new-private-chat', {
        chat: fullChat,
        isOnline: onlineStatusForRecipient,
      })

      res.status(200).json({ message: 'accepted', chat: fullChat })
    } catch (error) {
      console.error('Application error:', error)
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
      res.json({ message: 'Declined' })
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
          f.requesterId._id.toString() === userId
            ? f.recipientId
            : f.requesterId
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

  router.post('/deleteFriend', async (req, res) => {
    const { requesterId, recipientId } = req.body

    try {
      const deletedFriendship = await Friendship.findOneAndDelete({
        $or: [
          { requesterId, recipientId },
          { recipientId: requesterId, requesterId: recipientId },
        ],
      })

      if (!deletedFriendship) {
        return res.status(404).json({ message: 'Friendship not found' })
      }

      io.to(requesterId.toString()).emit(
        'friendshipDeleted',
        recipientId.toString()
      )
      io.to(recipientId.toString()).emit(
        'friendshipDeleted',
        requesterId.toString()
      )

      res.json({ message: 'Friend removed' })
    } catch (e) {
      console.error('Error while deleting friendship: ', e)
      res.status(500).json({ message: 'Server error' })
    }
  })

  return router
}
