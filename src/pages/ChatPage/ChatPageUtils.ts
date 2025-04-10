import { jwtDecode } from 'jwt-decode'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { AppDispatch } from '../../store'
import { removeToken } from '../../slices/authSlice'

export const isTokenValid = (token: any) => {
  if (!token) return false
  try {
    const decoded: any = jwtDecode(token)
    return decoded.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export const sendMessage = (socket: any, message: string, setMessage: any) => {
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
    socket.emit('message', { text: buffer })
  }
  setMessage('')
}

export const useLogout = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  dispatch(removeToken())
  localStorage.removeItem('token')
  navigate('/login')
}
