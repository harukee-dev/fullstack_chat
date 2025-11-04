// Импорт модуля os
const os = require('os') // встроенный модуль для работы с операционной системой сервера (машины, на которой стоит сервер)

const config = {
  listenIp: '0.0.0.0',
  listenPort: 3016,

  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,

    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 20000,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp', 'h264'],
    },

    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
          parameters: {
            useinbandfec: 1,
            usedtx: 1,
            maxaveragebitrate: 128000,
            stereo: 1,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42001f',
            'level-asymmetry-allowed': 1,
            'max-fr': 60,
            'max-fs': 8192,
            'max-mbps': 245760,
            'x-google-start-bitrate': 5000,
            'x-google-min-bitrate': 12000,
            'x-google-max-bitrate': 30000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1500,
            'x-google-min-bitrate': 4000,
            'x-google-max-bitrate': 8000,
            'max-fr': 60,
            'max-fs': 8192,
            complexity: 'high',
          },
        },
      ],
    },

    webRtcTransport: {
      listenIps: [{ ip: '0.0.0.0', announcedIp: '185.207.64.7' }],

      initialAvailableOutgoingBitrate: 35000000,
      minimumAvailableOutgoingBitrate: 15000000,
      maxIncomingBitrate: 30000000,
      enableSctp: true,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      maxSctpMessageSize: 262144,
      enableSimulcast: true,
    },
  },
}

// Экспорт конфигурации
module.exports = { config, secret: 'JWTSECRETKEYACCESS' } // основаня конфигурация, секретный ключ JWT токенов
