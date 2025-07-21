const User = require('./models/User')
const bcrypt = require('bcryptjs')
const { validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')
const { secret } = require('./config')
const Message = require('./models/Message')

function generateAccessToken(id, roles) {
  const payload = {
    id,
    roles,
  }
  return jwt.sign(payload, secret, { expiresIn: '24h' })
}

class authController {
  async registration(request, response) {
    try {
      const { username, password, avatar } = request.body
      const candidate = await User.findOne({ username })
      if (candidate) {
        return response
          .status(400)
          .json({ message: 'Пользователь с таким именем уже существует' })
      }
      if (username.length >= 4 && username.length <= 20) {
        const hasLowercase = /[a-z]/.test(password)
        const hasUppercase = /[A-Z]/.test(password)
        const hasDigit = /\d/.test(password)
        const hasSpecialChar = /[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]/.test(password)

        if (
          (hasLowercase && hasUppercase && hasDigit) ||
          (hasSpecialChar && hasLowercase && hasDigit) ||
          (hasSpecialChar && hasUppercase && hasDigit)
        ) {
          const hashPassword = bcrypt.hashSync(password, 5)
          if (!avatar) {
            const user = new User({
              username,
              password: hashPassword,
            })
            await user.save()
          } else {
            const user = new User({
              username,
              password: hashPassword,
              avatar,
            })
            await user.save()
          }
          return response.json({
            message: 'User created',
          })
        } else {
          return response.status(400).json({
            message: 'password is too easy',
          })
        }
      } else {
        return response
          .status(400)
          .json({ message: 'use 4 to 20 characters for login' })
      }
    } catch (e) {
      console.log(e)
      response.status(400).json({ message: 'Registration error' })
    }
  }

  async login(request, response) {
    try {
      const { username, password } = request.body

      const user = await User.findOne({ username })
      if (!user) {
        return response
          .status(400)
          .json({ message: `invalid login or password` })
      }

      const validPassword = bcrypt.compareSync(password, user.password)
      if (!validPassword) {
        return response
          .status(400)
          .json({ message: `invalid login or password` })
      }

      const token = jwt.sign(
        {
          username: user.username,
          id: user._id,
        },
        secret,
        { expiresIn: '24h' }
      )
      return response.json({ token, user })
    } catch (e) {
      console.log(e)
      response.status(400).json({ message: 'Login error' })
    }
  }

  async changeAvatar(request, response) {
    const { userId, avatar } = request.body

    if (!userId || !avatar) {
      return response
        .status(400)
        .json({ message: 'userId или avatar не указан' })
    }

    try {
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        { avatar: avatar.toString() },
        { new: true }
      )
    } catch (e) {
      console.log(e)
    }
  }

  async getUsers(request, response) {
    try {
      const users = await User.find()
      response.json(users)
    } catch (e) {
      console.log(e)
    }
  }
  async sendMessage(request, response) {
    try {
      const { username, text } = request.body

      if (!username || !text) {
        return response
          .status(400)
          .json({ message: 'Необходимо указать username и текст сообщения' })
      }

      const message = new Message({
        username,
        text,
      })

      await message.save()
      return response.json({ message: 'Сообщение отправлено', data: message })
    } catch (e) {
      console.log(e)
      response.status(500).json({ message: 'Ошибка при отправке сообщения' })
    }
  }
  async getMessages(request, response) {
    try {
      const messages = await Message.find().populate(
        'senderId',
        'username avatar'
      ) // Получаем все сообщения из БД
      response.json(messages)
    } catch (e) {
      console.log(e)
      response.status(500).json({ message: 'Ошибка при получении сообщений' })
    }
  }

  async editMessage(req, res) {
    try {
      const { id, text } = req.body
      if (!id || !text) {
        return res.status(400).json({ message: 'Недостаточно данных' })
      }

      try {
        const updated = await Message.findByIdAndUpdate(id, { text })
        if (!updated)
          return res.status(404).json({ message: 'Сообщение не найдено' })
        return res.json(updated)
      } catch (e) {
        console.error(e)
        res.status(500).json({ message: 'Ошибка сервера' })
      }
    } catch (e) {
      console.log(e)
    }
  }
  async getMessageById(req, res) {
    const { id } = req.params

    try {
      const message = await Message.findById(id)
      if (!message) {
        return res.status(404).json({ error: 'Сообщение не найдено' })
      }
      res.json(message)
    } catch (error) {
      console.error('Ошибка при получении сообщения:', error)
      res.status(500).json({ error: 'Внутренняя ошибка сервера' })
    }
  }
}

module.exports = new authController()
