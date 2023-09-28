import EventEmitter from 'events'
import { getSummary } from './helpers.js'

export class StreamManager extends EventEmitter {
  constructor (options = {}) {
    super()
    this.owner = options?.owner || null
    this.noiseStreams = []
    this.relayNoiseStreams = []
  }

  getCounts () {
    return {
      relayedPeersCount: this.relayNoiseStreams.length,
      peersCount: this.noiseStreams.length,
      totalPeersCount: this.relayNoiseStreams.length + this.noiseStreams.length
    }
  }

  getStreamsInfo () {
    return this.noiseStreams.map((s) => getSummary(s))
  }

  addStream (stream) {
    const index = this.noiseStreams.findIndex(
      (s) => s.remotePublicKey === stream.remotePublicKey
    )
    if (index === -1) {
      this.noiseStreams.push(stream)
      this.emit('streams:added', stream)
    }
  }

  removeStream (stream) {
    this.noiseStreams = this.noiseStreams.filter(
      (s) => s.remotePublicKey !== stream.remotePublicKey
    )
    this.emit('streams:removed', stream)
  }

  getRelayStreamsInfo () {
    return this.relayNoiseStreams.map((s) => getSummary(s))
  }

  addRelayStream (stream) {
    const index = this.relayNoiseStreams.findIndex(
      (s) => s.remotePublicKey === stream.remotePublicKey
    )
    if (index === -1) {
      this.relayNoiseStreams.push(stream)
      this.emit('relayStreams:added', stream)
    }
  }

  removeRelayStream (stream) {
    this.relayNoiseStreams = this.relayNoiseStreams.filter(
      (s) => s.remotePublicKey !== stream.remotePublicKey
    )
    this.emit('relayStreams:removed', stream)
  }
}
