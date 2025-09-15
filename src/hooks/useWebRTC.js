// Импорты нужных сущностей
import { useEffect, useRef, useCallback, useState } from 'react'
import useStateWithCallback from './useStateWithCallback'
import ACTIONS from '../backend/actions'
import { useSocket } from '../SocketContext'
import userJoinSound from './join-sound.mp3'
import userLeaveSound from './leave-sound.mp3'

// создание константы LOCAL_VIDEO - оно будет использоваться для вывода локального видео (вебки/стрима)
export const LOCAL_VIDEO = 'LOCAL_VIDEO'

// функция useWebRTC(принимает в себя айди комнаты, чтобы понимать, куда подключать пользователя)
export default function useWebRTC(roomID, isMicrophoneMuted) {
  const { socket } = useSocket() // инициализация сокета из контекста для передачи и принятия сигналов
  const [clients, updateClients] = useStateWithCallback([]) // стейт клиентов, состоящих в звонке
  const [isSpeaking, setIsSpeaking] = useState(false) // стейт, говорит ли сейчас юзер (проходит ли громкость его микрофона через порог чувствительности)
  const [thresholdDb, setThresholdDb] = useState(-42) // стейт порога чувтствительности в dB - позже будет в редаксе через настройки

  const addNewClient = useCallback(
    // функция добавления нового клиента в список клиентов звонка
    (newClient, cb) => {
      updateClients((list) => {
        if (!list.includes(newClient)) return [...list, newClient] // если клиента еще нет в списке, то добавляем его
        return list // если уже есть то просто возвращаем тот же список клиентов
      }, cb)
    },
    [updateClients]
  )

  const peerConnections = useRef({}) // переменная всех текущих соединений с другими клиентами, состоящими в звонке
  const localMediaStream = useRef(null) // переменная хранящая локальный медиа-поток (вебка/демка/микрофон)
  const peerMediaElements = useRef({ [LOCAL_VIDEO]: null }) // переменная которая хранит ссылки на html video элементы для отображения видео клиентов звонка (в том числе личного видео)

  // Обработка звука и войс-детекшн
  const audioContext = useRef(null) // главных контекст, движок для обработки аудио
  const gainNode = useRef(null) // узел управления громкостью (усиление/ослабление сигнала)
  const audioSource = useRef(null) // источник звука из микрофона - соединяет движок и медиапоток
  const analyserRef = useRef(null) // анализатор сигнала - в реальном времени изменяет громкость, частоты, амплитуду

  // Таймеры и интервалы
  const speakingCheckInterval = useRef(null) // интервал для периодической проверки уровня звука
  const silenceTimeout = useRef(null) // таймер задержки для определения тишины (через сколько мутить микро после молчания)

  // Состояния войс-детекшена
  const isSpeakingRef = useRef(false) // состояние гс активности (говорит/не говорит)
  const thresholdRef = useRef(thresholdDb) // порог чувствительности - синхронится со стейтом но используется в колбеках без замыканий
  const audioPlayer = useRef(null)
  const audioPlayerLeave = useRef(null)
  const isMicrophoneMutedRef = useRef(null)

  useEffect(() => {
    isMicrophoneMutedRef.current = isMicrophoneMuted
  }, [isMicrophoneMuted])

  // useEffect для порога чувствительности - благодаря нему узел чувствительности всегда имеет актуальное значение
  useEffect(() => {
    thresholdRef.current = thresholdDb // обновлять значение узла чувтвительности из стейта
    if (audioPlayer.current) {
      audioPlayer.current.pause()
      audioPlayer.current = null
    }
    if (audioPlayerLeave.current) {
      audioPlayerLeave.current.pause()
      audioPlayerLeave.current = null
    }
  }, [thresholdDb]) // каждый раз когда стейт меняется

  // Проверка уровня звука (RMS -> dB) с гистерезисом
  const checkAudioLevel = useCallback(() => {
    try {
      if (!analyserRef.current || !gainNode.current || !audioContext.current)
        // проверка, если проблема с анализатором, узлом управления громкостью или движком
        return // то мы делаем return

      const analyser = analyserRef.current // достаем анализатор из узла, чтобы более удобно использовать его
      const bufferLen = analyser.fftSize // связываем размер буфера анализа с настройками ФФТ анализатора

      const data = new Uint8Array(bufferLen) // переменная в которой хранится массив константной длины, в массиве находится актуальный отрезок звука (текущего)
      analyser.getByteTimeDomainData(data) // заполняет массив данными в виде звука
      // зачем нужны эти 2 строки? - для анализа звука: войс-детекшн по громкости текущего отрезка звука, визуализация волны звука (в будущем будет). этот код - основа для анализа звука в реальном времени

      // вычисление RMS
      let sum = 0 // создаем переменную, в которую мы будем класть среднюю громкость звука (RMS)

      for (let i = 0; i < bufferLen; i++) {
        // проходим по каждому значению звуковой волны
        const v = (data[i] - 128) / 128 // переводим наш сырой диапазонв диапазон от -1.0 до +1.0 (для удобной работы с данными звука в будущем)
        sum += v * v // суммируем квадраты всех значений (зачем: квадраты убирают отрицательные значения и усиливают различия)
      }
      const rms = Math.sqrt(sum / bufferLen) // вычисляем корень из среднего значения квадратов - получаем среднюю громкость (RMS)

      const db = rms > 1e-8 ? 20 * Math.log10(rms) : -100 // преобразуем RMS в децибелы - с ними удобнее всего будет работать

      // Проверка порога чувствительности
      const currentThreshold = thresholdRef.current // достаем чувствительность из узла в константу
      const isCurrentlySpeaking =
        db > currentThreshold && isMicrophoneMutedRef.current !== true // сравниваем текущую громкость с порогом - таким образом вычисляем, говорит клиент или нет

      // Мгновенное включение, выключение с задержкой
      if (isCurrentlySpeaking && !isSpeakingRef.current) {
        // если человек начал говорить и до этого молчал
        if (silenceTimeout.current) {
          // если существовал запущенный таймер, по истечении которого микрофон вернется в "состояние молчания"
          clearTimeout(silenceTimeout.current) // то мы его сбрасываем, чтобы не отключить микрофон в самом начале речи
          silenceTimeout.current = null
        }
        isSpeakingRef.current = true // устанавливаем флаги что человек говорит
        setIsSpeaking(true)
        gainNode.current.gain.cancelScheduledValues(
          // отменяем все запланированные изменения громкости - чтобы не было конфликтов между анимациями
          audioContext.current.currentTime
        )
        gainNode.current.gain.setTargetAtTime(
          // плавно включаем микрофон за 10ms, чтобы не было резких звуков щелчком или подобного
          1.0, // полная громкость
          audioContext.current.currentTime, // включить прямо сейчас
          0.01 // с переходом в 10мс для плавности
        )
      }

      // Задержанное выключение при тишине
      if (!isCurrentlySpeaking && isSpeakingRef.current) {
        // если человек перестал говорить и до этого говорил
        if (!silenceTimeout.current) {
          // если все еще не был создан таймер перехода в "режим тишины"
          silenceTimeout.current = setTimeout(() => {
            // то запускаем этот таймер, по истечении которого:
            isSpeakingRef.current = false // ставим все флаги на то, что клиент молчит
            setIsSpeaking(false)
            gainNode.current.gain.cancelScheduledValues(
              // плавно
              audioContext.current.currentTime
            )
            gainNode.current.gain.setTargetAtTime(
              // плавно переводим микрофон клиента в режим тишины
              0.0, // нулевая громкость
              audioContext.current.currentTime, // прямо сейчас
              0.07 // с переходом в 70мс для плавности
            )
            silenceTimeout.current = null // после чего сбрасываем значение переменной, в которо хранился таймер перехода в режим тишины
          }, 150) // таймер срабатывает через 150мс после начала тишины
        }
      }
    } catch (err) {
      // игнорируем ошибки
    }
  }, [])

  // Инициализация аудио контекста и GainNode
  useEffect(() => {
    try {
      // создаем аудио контекст - главный движок для обработки звука
      audioContext.current = new (window.AudioContext ||
        window.webkitAudioContext)({
        // поддержка разных браузеров
        sampleRate: 48000, // профессиональная частота для хорошего звука
        latencyHint: 'interactive', // минимальная задержка для реального времени
      })
      // Создание узла громкости
      gainNode.current = audioContext.current.createGain() // создает GainNode(усилитель/ослабитель громкости)
      gainNode.current.gain.value = 0 // начинаем с выключенного звука - микрофон в режиме тишины
    } catch (error) {
      console.warn('Failed to initialize audio processing:', error) // обработа ошибок инициализации
    }

    return () => {
      // очистка при размонтировании - предотвращение утечки памяти и ресурсов клиента
      try {
        if (speakingCheckInterval.current) {
          // если интервал проверки текущего звука существует
          clearInterval(speakingCheckInterval.current) // очищаем интервал
          speakingCheckInterval.current = null // сбрасываем узел интервала
        }
        if (silenceTimeout.current) {
          // если сейчас активен таймер входа в режим тишины
          clearTimeout(silenceTimeout.current) // сбрасываем таймер
          silenceTimeout.current = null // сбрасываем узел, в котором хранился таймер
        }
        if (audioSource.current) {
          // если источник аудио клиента существует
          try {
            audioSource.current.disconnect() // отключаем от аудио графа
          } catch (e) {}
          audioSource.current = null // при ошибке сбрасываем узел аудио клиента
        }
        if (analyserRef.current) {
          // если анализатор звука существует
          try {
            analyserRef.current.disconnect() // отключаем анализатор звука (освобождение ресурсов анализатора)
          } catch (e) {}
          analyserRef.current = null // при ошибке сбрасываем узел анализатора звука
        }
        if (gainNode.current) {
          // если узел громкости существует
          try {
            gainNode.current.disconnect() // отключаем узел громкости
          } catch (e) {}
          gainNode.current = null // сбрасываем узел громкости
        }
        if (audioContext.current) {
          // если аудио контекст (движок обработки звука) существует
          audioContext.current.close() // закрываем движок (выключаем)
          audioContext.current = null // сбрасываем узел движка
        }
      } catch (e) {
        // ошибки игнорируем
      }
    }
  }, [])

  // Ядро обработки аудио - создание аудио цепочки
  const processAudioStream = useCallback(
    async (originalStream) => {
      if (!audioContext.current || !gainNode.current) return originalStream // проверяем, инициализирована ли аудио система. если нет, то возвращаем дефолтный поток без обработки

      try {
        if (audioSource.current) {
          // если был предыдущий источник
          try {
            audioSource.current.disconnect() // отсоединяем его
          } catch (e) {}
          audioSource.current = null // сбрасываем узел источника аудио
        }
        if (analyserRef.current) {
          // если остался предыдущий анализатор аудио
          try {
            analyserRef.current.disconnect() // отключаем его
          } catch (e) {}
          analyserRef.current = null // сбрасываем узел анализатора звука
        }
        // все что было выше - подготовка системы для новой конфигурации (нового звонка если проще)

        // создаём источник, анализатор и destination
        audioSource.current =
          audioContext.current.createMediaStreamSource(originalStream) // созадем источник аудио из микрофона клиента

        // создаем и настраиваем анализатор звука
        analyserRef.current = audioContext.current.createAnalyser() // создаем анализатор и сохраняем его в узле
        analyserRef.current.fftSize = 512 // размер ФФТ (баланс между точностью и производительностью)
        analyserRef.current.smoothingTimeConstant = 0.3 // степень сглаживания
        // зачем - для анализа уровня звука в реальном времени

        const audioDestination =
          audioContext.current.createMediaStreamDestination() // создаем выходной пункт для обработанного аудио, чтобы преобраовать обработанный звук обратно в MediaStream

        // построение аудио цепочки - соединяем адуио узлы в цепочку обработки
        audioSource.current.connect(analyserRef.current) // микрофон
        analyserRef.current.connect(gainNode.current) // анализатор
        gainNode.current.connect(audioDestination) // усилитель
        // каждый узел цепочки выполняет свою роль в обработке аудио

        if (speakingCheckInterval.current) {
          // если остался старый интервал проверки текущего аудио потока
          clearInterval(speakingCheckInterval.current) // очищаем его
        }

        speakingCheckInterval.current = setInterval(checkAudioLevel, 100) // запускаем новый интервал проверки текущего звука (каждые 100мс)

        // собираем финальный поток (обработанный аудио + оригинальное видео)
        const processedStream = new MediaStream() // создаем новый медиапоток для результата
        audioDestination.stream
          .getAudioTracks()
          .forEach((t) => processedStream.addTrack(t)) // добавляем обработанные аудио треки (после обработки) из нашего выходного потока в медиапоток результата
        originalStream
          .getVideoTracks()
          .forEach((t) => processedStream.addTrack(t)) // добавляем оригинальные видео треки (без обработки) из нашего выходного потока в медиапоток результата
        // вся обработка происходила в audioDesctionation, а после того, как мы закончили все этапы обработки - мы перенесли их в новый медиапоток, который будем уже выводить
        return processedStream // возвращаем обработанный поток
      } catch (error) {
        // в случае ошибки
        console.error('Audio processing failed:', error) // выводим ошибку о том, что обработка не удалась
        return originalStream // и возвращаем оригинальный медиапоток - таким образом, даже при сбое обработки, наш звонок будет работать
      }
    },
    [checkAudioLevel]
  )

  // Обработка новых Peer соединений
  useEffect(() => {
    audioPlayer.current = new Audio(userJoinSound)
    audioPlayer.current.volume = 1.0
    async function handleNewPeer({ peerID, createOffer }) {
      // создаем асинхронную функцию, которая будет срабатывать при подключении нового клиента в звонок
      if (peerID in peerConnections.current) {
        // если клиент уже есть в списке подключенных к звонку клиентов
        return console.warn(`Already connected to peer ${peerID}`) // делаем лог в консоль, что он уже подключен
      } // это защита от дубликатов соединений

      peerConnections.current[peerID] = new RTCPeerConnection({
        // создаем новое WebRTC соединение с STUN-сервером
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], // STUN-сервер позволяет установить прямое P2P соединение через NAT
      })

      peerConnections.current[peerID].onicecandidate = (event) => {
        // при получении icecandidates из нового соединения
        if (event.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            // отпраляем их другому peer'у
            peerID, // айди пира которому отправляем
            iceCandidate: event.candidate, // icecandidate нового пира
          })
        }
      }

      let tracksNumber = 0 // счетчик треков
      peerConnections.current[peerID].ontrack = ({
        streams: [remoteStream], // обработчик входящих медиапотоков, ждем пока придут оба трека (аудио + видео)
      }) => {
        tracksNumber++
        if (tracksNumber === 2) {
          // когда получили два трека - добавляем нового клиента в звонок (убеждаемся, что пришло и аудио, и видео)
          tracksNumber = 0 // обнуляем счетчик треков для следующего подключения
          addNewClient(peerID, () => {
            if (peerMediaElements.current[peerID]) {
              // если элемент создан
              peerMediaElements.current[peerID].srcObject = remoteStream // назначаем медиапоток video элементу

              if (audioPlayer.current) {
                audioPlayer.current.currentTime = 0
                audioPlayer.current.play().catch((e) => console.log(e))
              }
            } else {
              // иначе, если элемент еще не создан
              let settled = false // создаем временную переменную - создан ли элемент
              const interval = setInterval(() => {
                // запускаем интервал каждую 1 секунду
                if (peerMediaElements.current[peerID]) {
                  // если элемент создался
                  peerMediaElements.current[peerID].srcObject = remoteStream // назначаем медиапоток video элементу

                  if (audioPlayer.current) {
                    audioPlayer.current.currentTime = 0
                    audioPlayer.current.play().catch((e) => console.log(e))
                  }

                  settled = true // задаем значение временное переменной, что все создалось, чтобы закончить интервал
                }
                if (settled) clearInterval(interval) // если переменная true, то есть элемент создался, то сбрасываем интервал
              }, 1000) // эта проверка будет каждую секунду, пока элемент не создастся
            }
          })
        }
      }

      if (localMediaStream.current) {
        // если локальный медиапоток есть
        localMediaStream.current.getTracks().forEach((track) => {
          // проходимся по всем трекам медиапотока (аудио и видео, позже и демка)
          peerConnections.current[peerID].addTrack(
            // добавляем наши локальные треки в соединение, тем самым отправляем наш микрофон и камеру другому пользователю
            track,
            localMediaStream.current
          )
        })
      }

      if (createOffer) {
        // если мы хост
        const offer = await peerConnections.current[peerID].createOffer() // создаем SDP-offer
        await peerConnections.current[peerID].setLocalDescription(offer)
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: offer }) // и отправляем его
      } // тем самым начинаем процесс установления соединения
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer) // подписываемся на событие добавления нового пира
    return () => {
      if (audioPlayer.current) {
        audioPlayer.current.pause()
        audioPlayer.current = null
      }
      socket.off(ACTIONS.ADD_PEER)
    } // и отписываемся при размонтировании
  }, [socket, addNewClient]) // тем самым обработка входащих подключений с правильной очисткой при размонтировании

  // Процесс установления соединения (то что выше):
  // 1. Сервер -> к тебе подключается новый пир
  // 2. создаем RTCPeerConnection для нового пира
  // 3. Настраиваем обработчики ICE и медиапотоков
  // 4. Отправляем наши треки этому новому пиру -> теперь он нас видит (точно так же и он отправляет его треки нам)
  // 5. Создаем оффер (если мы инициаторы, то есть мы подключились, а не он)
  // 6. Обмениваемся ICE Кандидатами через сервер для установки P2P соединения
  // 7. Устанавливаем соединение
  // Это ядро веб-звонков

  // Что такое ICE-Кандидаты? - это объяект с информацией о клиенте: его девайс, айпи, система и осталньые технические характеристики, которые нужны для корректной установки соединения друг между другом
  // Они нужны так же, как нам нужно знать ник друга, чтобы ему написать - здесь же нужна инфа о машине клиента, чтобы соединиться с ним и говорить

  useEffect(() => {
    async function setRemoteMedia({
      // создаем функцию для обработки офферов и ответов на эти офферы (ансверов)
      peerID, // получаем айди пира, от которого нам пришел сигнал через сервер
      sessionDescription: remoteDescription, // получаем его данные для соединения
    }) {
      await peerConnections.current[peerID]?.setRemoteDescription(
        // добавляем этот пир в список наших текущих пиров
        new RTCSessionDescription(remoteDescription) // в виде rtcsessiondescription
      )
      // проверка на оффер или ансвер
      if (remoteDescription.type === 'offer') {
        // если этот сигнал, полученные нами - оффер (то есть тот пир является инициатором)
        const answer = await peerConnections.current[peerID].createAnswer() // то мы создаем ответ на этот оффер
        await peerConnections.current[peerID].setLocalDescription(answer) // устанавливаем наш ансвер как локальное описание - фиксируем параметры нашего конца соединения
        socket.emit(ACTIONS.RELAY_SDP, { peerID, sessionDescription: answer }) // возвращаем этот ответ тому пиру
      }
    }

    // если же это был не оффер, а ансвер, то мы делаем только то, что было перед if - сохраняем его ансвер у нас в соединениях, и у обоих теперь есть данные друг о друге для соединения
    // КАК ЭТО РАБОТАЕТ?

    // Сценарий 1: мы инициатор подключения
    // 1) мы -> создаем оффер -> отправляем оффер пиру, к которому хотим подключиться
    // 2) пир -> получает оффер -> сохраняет у себя его данные -> создает ансвер -> отправляет нам ансвер
    // 3) мы -> получаем ансвер -> сохраняем данные ансвера -> соединение установлено!

    // Сценарий 2: пир инициатор подключения
    // 1) пир -> создает оффер -> отправляет нам оффер
    // 2) мы -> получаем оффер -> сохраняем его данные -> создаем на него ансвер -> отправляем ансвер пиру в ответ
    // 3) пир -> получает ансвер -> сохраняет его данные -> соединение установлено!

    // ЧТО СОДЕРЖИТ SDP (то самое, что мы отправляем пиру в оффере ансвере (и он нам)):
    // Кодеки - какие форматы аудио/видео поддерживаются у устройства юзера
    // ICE Кандидаты - сетевые пути для соединения (есть объяснение в Obsidian/frontend/WebRTC)
    // Media constraints - разрешения, битрейты, профили (настройки передачи)
    // Session information - метаданные сессии (Obsidian/frontend/WebRTC)

    // Это критическая часть WebRTC, которая обеспечивает совместимость между разными браузерами и устройствами

    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia) // устанавливаем нашу функцию как обработчик сигнала из сервера, чтобы функция срабатывала, когда мы получаем оффер или ансвер с описанием пира
    return () => socket.off(ACTIONS.SESSION_DESCRIPTION) // очищаем функцию при размонтировании
  }, [socket])

  // Обработка входящих ICE Кандидатов
  useEffect(() => {
    // создаем эффект, который выполняется при монтировании компонента. Для подписки на сетевые события
    socket.on(ACTIONS.ICE_CANDIDATE, ({ peerID, iceCandidate }) => {
      // принимаем айди пира и его айс кандидаты
      // при сигнале о ICE кандидатах от сервера мы начинаем обрабатывать полученные данные
      peerConnections.current[peerID]?.addIceCandidate(
        // если существует соединение с айдишником пира, который нам отправил айс кандидаты
        new RTCIceCandidate(iceCandidate) // сохраняем адреса пира (айс кандидаты) в виде объекта кандидата
      )
    })
    return () => socket.off(ACTIONS.ICE_CANDIDATE) // очистка обработки сигнала при размонтировании компонента
  }, [socket])

  // Обработка удаления пира (при его выходе из звонка)
  useEffect(() => {
    // создаем эффект
    audioPlayerLeave.current = new Audio(userLeaveSound)
    audioPlayerLeave.current.volume = 1.0
    const handleRemovePeer = ({ peerID }) => {
      // делаем функцию для обработки сигнала об удалении пира
      if (peerConnections.current[peerID])
        // еслиу нас в соединениях с пирами есть этот пир
        peerConnections.current[peerID].close() // то закрываем это соединение
      delete peerConnections.current[peerID] // удаляем это соединение с пиром из списка текущих пир соединений
      delete peerMediaElements.current[peerID] // удаляем медиа (аудио/видео) этого пира из списка текущих медиа элементов
      updateClients((list) => list.filter((c) => c !== peerID)) // обновляем стейт текущих клиентов, состоящих в звонке
      if (audioPlayerLeave.current) {
        audioPlayerLeave.current.currentTime = 0
        audioPlayerLeave.current.play().catch((e) => console.log(e))
      }
    }

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer) // делаем обработку вышенаписанной функцией сигнала об удалении пира (отключении из звонка какого-то пользователя)
    return () => socket.off(ACTIONS.REMOVE_PEER) // очистка обработки при размонтировании компонента
  }, [socket, updateClients])

  // Запуск захвата медиа и управление жизненным циклом
  useEffect(() => {
    async function startCapture() {
      // создаем асинхронную функцию для запуска медиазахвата
      try {
        const originalStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // берем аудио с найстроками качества ниже
            echoCancellation: true, // эхоподавление включено
            noiseSuppression: true, // шумоподавление включено
            autoGainControl: false, // автоусиление выключено
            channelCount: 1, // 1 канал, то есть моно звук (одинаковый в обоих наушниках)
          },
          video: {
            // берем видео с настройками качества ниже
            width: 1920, // фулл хд
            height: 1080, // фулл хд
            frameRate: 60, // 60 фпс
          },
        })

        const finalStream = await processAudioStream(originalStream) // обрабатываем сырой аудиопоток через нашу систему (шумодав, войс-детекшн и тд)
        localMediaStream.current = finalStream // сохраняем обработанный поток в реф, чтобы использовать его для подключения к другим пирам

        addNewClient(LOCAL_VIDEO, () => {
          // добавляем локальное видео в список клиентов и настраиваем video элемент
          const localVideoElement = peerMediaElements.current[LOCAL_VIDEO] // добавляем новый элемент в список клиентов с айди LOCAL_VIDEO
          if (localVideoElement) {
            // если с элементом все хорошо
            localVideoElement.volume = 0 // то выставляем ему громкость 0 (чтобы мы не слышали сами себя в наушниках)
            localVideoElement.srcObject = finalStream // и назначаем наш поток video элементу
          }
        })

        socket.emit(ACTIONS.JOIN, { room: roomID }) // отправляем серверу запрос на присоединение к комнате
      } catch (error) {
        console.error('Error starting media capture:', error) // обработка ошибок при получении медиапотока
      }
    }

    startCapture() // вызываем функцию медиазахвата, начинаем процесс при монтировании объекта

    // Очистка при размонтировании
    return () => {
      if (speakingCheckInterval.current) {
        // если интервал проверки звука активен
        clearInterval(speakingCheckInterval.current) // очищаем его
        speakingCheckInterval.current = null // и сбрасываем реф интервала
      }
      if (silenceTimeout.current) {
        // если таймер перехода в режим тишины активен
        clearTimeout(silenceTimeout.current) // очищаем его
        silenceTimeout.current = null // и сбрасываем реф таймера
      }
      if (localMediaStream.current) {
        // если у нас идет захват медика
        localMediaStream.current.getTracks().forEach((track) => track.stop()) // останавливаем все треки, тем самым захват закончится
        localMediaStream.current = null // и сбрасываем реф медиастрима
      }
      try {
        socket.emit(ACTIONS.LEAVE) // отправляем серверу, что мы покинули комнату
      } catch (e) {}
    }
  }, [roomID, socket, addNewClient, processAudioStream])

  const provideMediaRef = useCallback((id, node) => {
    // функция колбек, которая связывает медиа с видео элементами в компоненте комнаты
    // принимает в себя айди пира и node (сам видео элемент, с которым мы свяжем медиа)
    peerMediaElements.current[id] = node // связываем их
  }, [])

  return {
    clients, // список клиентов, для отображения всех участников звонка
    provideMediaRef, // функция привязки для связи видео элементов с хуком
    isSpeaking, // состояние активности голоса для индикации говорит/не говорит
    thresholdDb, // текущий порог чувствительности
    setThresholdDb, // функция изменения порога чувствительности
  }
}
