const os = require('os')

const config = {
  listenIp: '0.0.0.0',
  listenPort: 3016,

  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,

    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'debug',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },

    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
            'x-google-max-bitrate': 2000,
          },
        },
      ],
    },

    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.SERVER_IP || '127.0.0.1',
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
    },
  },
}

module.exports = { config, secret: 'JWTSECRETKEYACCESS' }
