const User = require('./models/User')
const Role = require('./models/Role')
const bcrypt = require('bcryptjs')
const { validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')
const { secret } = require('./config')

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
      const errors = validationResult(request)
      if (!errors.isEmpty()) {
        return response
          .status(400)
          .json({ message: 'Ошибка при регистрации', errors })
      }
      const { username, password } = request.body
      const candidate = await User.findOne({ username })
      if (candidate) {
        return response
          .status(400)
          .json({ message: 'Пользователь с таким именем уже существует' })
      }
      const hashPassword = bcrypt.hashSync(password, 5)
      const userRole = await Role.findOne({ value: 'USER' })
      const user = new User({
        username,
        password: hashPassword,
        roles: [userRole.value],
      })
      await user.save()
      return response.json({ message: 'Пользователь успешно зарегистрирован' })
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
          .json({ message: `пользователь с именем ${username} не найден` })
      }

      const validPassword = bcrypt.compareSync(password, user.password)
      if (!validPassword) {
        return response.status(400).json({ message: `введен неверный пароль` })
      }

      const token = jwt.sign(
        {
          username: user.username,
          id: user._id,
        },
        secret,
        { expiresIn: '1h' }
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
}

module.exports = new authController()
