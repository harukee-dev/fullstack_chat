class authController {
  async registration(request, response) {
    try {
    } catch (e) {
      console.log(e)
    }
  }

  async login(request, response) {
    try {
    } catch (e) {
      console.log(e)
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
