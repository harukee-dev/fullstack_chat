const { Schema, model, Types } = require('mongoose')

const FriendshipSchema = new Schema({
  requesterId: { type: Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending',
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
})

module.exports = model('Friendship', FriendshipSchema)
