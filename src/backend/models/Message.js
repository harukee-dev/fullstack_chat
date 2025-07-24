const { Schema, Types, model } = require('mongoose')

const messageSchema = new Schema({
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  senderId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chatId: {
    type: Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  replyMessage: {
    username: String,
    text: String,
  },
  isPinned: { type: Boolean, default: false },
})

const Message = model('Message', messageSchema)

module.exports = Message
