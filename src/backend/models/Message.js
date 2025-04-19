const { Schema, model } = require('mongoose')

const MessageSchema = new Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, required: false },
  replyMessage: { type: { username: String, text: String }, required: false },
  isPinned: { type: Boolean, required: false },
})

module.exports = model('Message', MessageSchema)
