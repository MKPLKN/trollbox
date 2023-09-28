import { createSchema, decodeMessage, encodeMessage } from './codecify.js'

export class MessageManager {
  constructor (user) {
    this.user = user
    this._init()
  }

  _init () {
    createSchema('newMessage', {
      _size: 'uint', // Easy access to the total message size in bytes
      event: 'string',
      id: 'uint',
      user: 'string',
      text: { _type: 'string', maxChars: 140 }
    }, { maxSize: 300 })

    createSchema('networkSummary', {
      _size: 'uint',
      event: 'string',
      data: 'any'
    })
  }

  newMessageStruct (msg) {
    return {
      event: 'newMessage',
      id: Date.now(),
      user: this.user,
      text: msg
    }
  }

  networkSummaryStruct (data) {
    return {
      event: 'networkSummary',
      data
    }
  }

  encodeMessage (data) {
    if (typeof data === 'string') {
      data = this.newMessageStruct(data)
    }
    return encodeMessage(data)
  }

  decodeMessage (data) {
    return decodeMessage(data)
  }

  sendMessage (streams, msg) {
    const message = encodeMessage({
      event: 'newMessage',
      id: Date.now(),
      user: this.user,
      text: msg
    })
    streams.forEach((s) => s.write(message))
  }
}
