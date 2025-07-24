const Router = require('express')
const router = new Router()
const controller = require('./authController')
const { check } = require('express-validator')

router.post('/registration', controller.registration)

router.post('/login', controller.login)

router.get('/users', controller.getUsers)

router.post('/sendMessage', controller.sendMessage)

router.get('/messages/:chatId', controller.getMessages)

router.post('/editMessage', controller.editMessage)

router.get('/getMessage/:id', controller.getMessageById)

router.post('/changeAvatar', controller.changeAvatar)

router.get('/user-chats/:userId', controller.userChats)

module.exports = router
