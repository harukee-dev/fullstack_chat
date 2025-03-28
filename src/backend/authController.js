const User = require('./models/User')
const Role = require('./models/Role')
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
      const { username, password } = request.body
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

        if (hasLowercase && hasUppercase && hasDigit && hasSpecialChar) {
          const hashPassword = bcrypt.hashSync(password, 5)
          const userRole = await Role.findOne({ value: 'USER' })
          const user = new User({
            username,
            password: hashPassword,
            roles: [userRole.value],
          })
          await user.save()
          return response.json({
            message: 'Пользователь успешно зарегистрирован',
          })
        } else {
          return response.status(400).json({
            message:
              'Пароль должен иметь хотя бы одну цифру, заглавную и строчную букву и специальный символ',
          })
        }
      } else {
        return response
          .status(400)
          .json({ message: 'Логин должен быть от 4 до 20 символов' })
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
          .json({ message: `Пользователь с именем ${username} не найден` })
      }

      const validPassword = bcrypt.compareSync(password, user.password)
      if (!validPassword) {
        return response.status(400).json({ message: `Введен неверный пароль` })
      }

      const token = jwt.sign(
        {
          username: user.username,
          id: user._id,
        },
        secret,
        { expiresIn: '24h' }
      )
      return response.json({ token })
    } catch (e) {
      console.log(e)
      response.status(400).json({ message: 'Login error' })
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
      const messages = await Message.find() // Получаем все сообщения из БД
      response.json(messages)
    } catch (e) {
      console.log(e)
      response.status(500).json({ message: 'Ошибка при получении сообщений' })
    }
  }
}

module.exports = new authController()
