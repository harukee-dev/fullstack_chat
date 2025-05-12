const { Schema, model, Types } = require('mongoose')

const MessageSchema = new Schema({
  chatId: { type: Types.ObjectId, ref: 'Chat', required: false },
  senderId: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  replyMessage: {
    type: {
      username: String,
      text: String,
    },
    required: false,
  },
  isPinned: { type: Boolean, default: false },
})

module.exports = model('Message', MessageSchema)
