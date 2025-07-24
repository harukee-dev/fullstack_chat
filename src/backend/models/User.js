const { Schema, model, Types } = require('mongoose')

const UserSchema = new Schema({
  username: { type: String, unique: true, required: true },
  avatar: { type: String },
  password: { type: String, required: true },
  roles: [{ type: String }],
  online: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  subscription: {
    type: String,
    enum: ['free', 'flux'],
    default: 'free',
    required: true,
  },
  userChats: [{ type: Types.ObjectId, ref: 'Chat' }],
})

module.exports = model('User', UserSchema)
