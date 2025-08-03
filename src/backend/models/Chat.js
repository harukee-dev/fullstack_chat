const { Schema, model, Types } = require('mongoose')

const ChatSchema = new Schema({
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true,
  },
  members: [{ type: Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

module.exports = model('Chat', ChatSchema)
