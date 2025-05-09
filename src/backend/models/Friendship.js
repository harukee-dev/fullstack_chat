const { Schema, model, Types } = require('mongoose')

const Friendship = new Schema({
  requesterId: { type: Types.ObjectId, required: true },
  recipientId: { type: Types.ObjectId, required: true },
  status: {
    type: String,
    enum: ['pending, accepted', 'declined', 'blocked'],
    default: 'pending',
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
})

module.exports = model('Friendship', Friendship)
