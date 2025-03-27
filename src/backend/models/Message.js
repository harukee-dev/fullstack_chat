const { Schema, model } = require('mongoose')

const MessageSchema = new Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
})

module.exports = model('Message', MessageSchema)
