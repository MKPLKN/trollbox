import EventEmitter from 'events'
import { WebSocketServer } from 'ws'
import DHT from 'hyperdht'
import DHTRelay, { relay } from '@hyperswarm/dht-relay'
import Hyperswarm from 'hyperswarm'
import goodbye from 'graceful-goodbye'
import Stream from '@hyperswarm/dht-relay/ws'
import b4a from 'b4a'

import { StreamManager } from './stream-manager.js'
import { MessageManager } from './message-manager.js'
import { generateRandomName, getSwarmSummary, toHex } from './helpers.js'

class TrollboxBase extends EventEmitter {
  constructor (opts = {}) {
    super()
    this.user = opts?.user || generateRandomName()
    this.messageManager = new MessageManager(this.user)
    this.keyPair = null
  }

  get key () {
    return this.keyPair ? b4a.toString(this.keyPair.publicKey, 'hex') : null
  }

  networkSummaryStruct (data = {}) {
    return this.messageManager.networkSummaryStruct(data)
  }

  newMessageStruct (msg) {
    return this.messageManager.newMessageStruct(msg)
  }

  encodeMessage (msg) {
    return this.messageManager.encodeMessage(msg)
  }

  decodeMessage (msg) {
    return this.messageManager.decodeMessage(msg)
  }
}

export class TrollboxClient extends TrollboxBase {
  constructor (opts = {}) {
    super(opts)

    this.keyPair = opts?.seed ? DHT.keyPair(b4a.from(opts?.seed)) : null
    this.wsUrl = opts.wsUrl || 'ws://localhost:8080'
  }

  async serverKey () {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wsUrl)
      socket.onmessage = (d) => {
        try {
          const msg = JSON.parse(d.data)
          if (msg?.connectionKey) {
            resolve(msg.connectionKey)
          }
        } catch (error) {
          reject(error)
        }
      }
      this.dhtRelay = new DHTRelay(new Stream(true, socket), { keyPair: this.keyPair })
      this.dhtRelay.ready()
    })
  }

  connect (key) {
    this.dhtSocket = this.dhtRelay.connect(b4a.from(key, 'hex'))

    return this.dhtSocket
  }

  sendMessage (msg) {
    console.log(msg)
    this.dhtSocket.write(this.encodeMessage(msg))
  }
}

export class Trollbox extends TrollboxBase {
  constructor (opts = {}) {
    super(opts)
    this.topic = opts?.topic ? b4a.from(opts.topic, 'hex') : Buffer.alloc(32).fill('tr0llb0x')
    this.keyPair = DHT.keyPair(opts?.seed)
    this.dht = new DHT({ keyPair: this.keyPair })
    this.streamManager = new StreamManager({ owner: this.key })
    this.swarm = new Hyperswarm({ dht: this.dht })
    this.isRelay = opts.isRelay === true
    goodbye(async () => {
      console.log('Good bye!')
      await this.swarm.destroy()
    })
    if (opts.autoStart !== false) {
      this.start()
    }
    if (this.isRelay) {
      this.port = opts?.port || 8080
      this.startRelayServer()
      this.startWebSocketServer()
    }

    const peersCountChangedCallback = () => {
      this.emit('peers:countChanged', this.streamManager.getCounts())
    }

    this.streamManager.on('streams:added', peersCountChangedCallback)
    this.streamManager.on('streams:removed', peersCountChangedCallback)

    this.streamManager.on('relayStreams:added', peersCountChangedCallback)
    this.streamManager.on('relayStreams:removed', peersCountChangedCallback)
  }

  get noiseStreams () {
    return this.streamManager.noiseStreams
  }

  get relayStreams () {
    return this.streamManager.relayNoiseStreams
  }

  get swarmSummary () {
    return getSwarmSummary(this.swarm)
  }

  sendMessage (msg) {
    this.noiseStreams.forEach(s => s.write(this.encodeMessage(msg)))
  }

  // Methods to start and listen to clients
  async start () {
    this.emit('beforeStart')

    this.swarm.server.on('close', () => {
      console.log('Swarm server closed...')
    })
    this.swarm.on('connection', (noiseStream, peerInfo) => {
      const id = toHex(noiseStream.remotePublicKey)
      console.log(`Trollbox connected to ${id}`)

      noiseStream.on('error', (err) => {
        console.log(err)
        this.streamManager.removeStream(noiseStream)
      })

      noiseStream.on('close', () => {
        console.log('Closed..')
        this.streamManager.removeStream(noiseStream)
      })

      noiseStream.on('end', () => {
        console.log('Ended..')
        this.streamManager.removeStream(noiseStream)
      })

      noiseStream.on('data', (data) => {
        this.emit('connectionData', noiseStream, data)
        if (this.isRelay) {
          this.relayStreams.forEach((s) => s.write(data))
        }
      })

      this.streamManager.addStream(noiseStream)

      // Emit an event to indicate that a new connection has been handled
      this.emit('newConnectionHandled', noiseStream)
    })

    const discovery = this.swarm.join(this.topic)
    await discovery.flushed().then(() => {
      console.log(`Joined to topic: ${b4a.toString(this.topic, 'hex')}`)
    })

    this.emit('afterStart')
  }

  async startRelayServer () {
    this.emit('beforeRelayServerStart')

    this.relayServer = this.dht.createServer()
    await this.relayServer.listen()

    this.relayServer.on('connection', (relayStream, peerInfo) => {
      const id = toHex(relayStream.remotePublicKey)
      console.log(`Relay server connected to frontend: ${id}`)

      relayStream.on('error', (err) => {
        this.streamManager.removeRelayStream(relayStream)
        this.emit('relayConnectionError', relayStream, err)
      })

      relayStream.once('close', () => {
        this.streamManager.removeRelayStream(relayStream)
        this.emit('relayConnectionClose', relayStream)
      })

      relayStream.on('data', (data) => {
        const message = this.messageManager.decodeMessage(data)

        this.noiseStreams.forEach((s) => s.write(data))

        this.relayStreams.forEach((s) => {
          if (s.remotePublicKey !== relayStream.remotePublicKey) {
            s.write(data)
          }
        })

        this.emit('relayConnectionData', relayStream, message)
      })

      this.streamManager.addRelayStream(relayStream)

      this.emit('newRelayConnection', relayStream)
    })

    this.emit('afterRelayServerStart')
  }

  startWebSocketServer () {
    const wssServer = new WebSocketServer({ port: this.port })
    wssServer.on('connection', async (socket) => {
      console.log('Websocket connection!')

      const msg = { connectionKey: toHex(this.dht.defaultKeyPair.publicKey) }
      socket.send(JSON.stringify(msg))

      relay(this.dht, new Stream(false, socket))
    })
  }
}
