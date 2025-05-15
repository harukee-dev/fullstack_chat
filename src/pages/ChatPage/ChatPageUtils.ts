import { jwtDecode } from 'jwt-decode'
import { IMessage } from '../../types/IMessage'
import { useAppSelector } from '../../store'

export const isTokenValid = (token: any) => {
  if (!token) {
    return false
  }
  try {
    const decoded: any = jwtDecode(token)
    return decoded.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export const sendMessage = (
  socket: any,
  message: string,
  setMessage: any,
  replyMessage: IMessage | null
) => {
  const currentUserId = localStorage.getItem('user-id')
  if (!socket || message.trim() === '') {
    console.log('Ошибка: сообщение пустое или сокет не подключен')
    return
  } // проверяем что сокет подключен и сообщение не пустое

  const maxLength = 1000 // задаем максимальную длину сообщения

  // Разделяем сообщение на слова - убираем лишние пробелы в начале и в конце, делаем из строки массив слов
  const words = message.trim().split(' ')
  let buffer = '' // создаем переменную в которую будем класть слова пока длина не станет больше 1000

  for (let i = 0; i < words.length; i++) {
    // создаем цикл который будет проходиться по массиву слов
    const word = words[i] // задаем слово

    // Проверяем, влезает ли слово в буфер
    if ((buffer + ' ' + word).trim().length <= maxLength) {
      buffer = (buffer + ' ' + word).trim() // если влезает, то добавляем в буфер еще одно слово
    } else {
      if (buffer.length > 0) {
        socket.emit('message', { text: buffer }) // если не влезает и буфер не пустой то отправляем наш заполненный буфер как сообщение
      }
      buffer = word // начинаем новую часть
    }
  }

  // Отправляем оставшийся буфер
  if (buffer.length > 0) {
    if (replyMessage !== null) {
      socket.emit('message', {
        text: buffer,
        replyUser: replyMessage.senderId.username,
        replyText: replyMessage.text,
        senderId: currentUserId,
      })
      socket.emit('stopTyping')
    } else {
      socket.emit('message', { text: buffer, senderId: currentUserId })
      socket.emit('stopTyping')
    }
  }
  setMessage('')
}
