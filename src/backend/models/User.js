const { Schema, model } = require('mongoose')

const User = new Schema({
  username: { type: String, unique: true, required: true },
  avatar: { type: String, required: false },
  password: { type: String, unique: false, required: true },
  roles: { type: String, ref: 'Role' },
  online: { type: Boolean, required: false },
})

module.exports = model('User', User)
