const { Schema, Types, model } = require('mongoose')

const messageSchema = new Schema({
  text: String,
  timestamp: { type: Date, default: Date.now },
  senderId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  },
  replyMessage: {
    username: String,
    text: String,
  },
  isPinned: Boolean,
})

const Message = model('Message', messageSchema)

module.exports = Message
