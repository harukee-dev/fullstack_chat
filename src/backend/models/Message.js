const { Schema, model } = require('mongoose')

const MessageSchema = new Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, required: false },
})

module.exports = model('Message', MessageSchema)
