const User = require('./models/User')
const Role = require('./models/Role')
const bcrypt = require('bcryptjs')

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
    } catch (e) {
      console.log(e)
      response.status(400).json({ message: 'Login error' })
    }
  }

  async getUsers(request, response) {
    try {
      response.json('server work')
    } catch (e) {
      console.log(e)
    }
  }
}

module.exports = new authController()
