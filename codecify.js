import cenc from 'compact-encoding'

// Base Schema Interface
class BaseSchema {
  constructor (fields) {
    this.fields = fields
  }

  preencode (state, val) {}
  encode (state, val) {}
  decode (state) {}

  hasKey (key) {
    return Object.prototype.hasOwnProperty.call(this.fields, key)
  }
}

class DynamicSchema extends BaseSchema {
  // Helper to handle the encoding and decoding operations
  _processFields (state, val, operation) {
    const obj = {}
    let startState = state.start // To capture initial state for size calculation during decode
    for (const [key, field] of Object.entries(this.fields)) {
      const type = field._type || field
      const maxSize = field.maxSize
      const maxChars = field.maxChars
      const minSize = field.minSize
      const minChar = field.minChar
      const isValidationObj = field._type !== undefined

      if (!isValidationObj && type instanceof BaseSchema) {
        if (operation === 'decode') {
          obj[key] = type.decode(state)
        } else {
          type[operation](state, val[key])
        }
      } else {
        if (operation === 'decode') {
          if (String(type).includes('|')) {
            const [t, t2] = type.split('|') // For example: array|string
            obj[key] = cenc[t](cenc[t2]).decode(state)
          } else {
            obj[key] = cenc[type].decode(state)
          }
        } else {
          if (String(type).includes('|')) {
            const [t, t2] = type.split('|') // For example: array|string
            cenc[t](cenc[t2])[operation](state, val[key])
          } else {
            cenc[type][operation](state, val[key])
          }
        }
      }

      // Validate sizes
      if (isValidationObj && (maxSize || maxChars || minSize || minChar)) {
        const fieldValue = operation === 'decode' ? obj[key] : val[key]
        const fieldSize = operation === 'decode' ? state.start - startState : null
        this._validateFieldSize({ type, key, fieldValue, fieldSize, maxSize, minSize, minChar, maxChars })
      }

      // Reset startState for the next iteration during decode
      if (operation === 'decode') {
        startState = state.start
      }
    }

    // Return the constructed object only for decode operation
    if (operation === 'decode') {
      return obj
    }
  }

  // Helper to validate field size
  _validateFieldSize (fields = {}) {
    const { key, fieldValue, fieldSize, maxSize, minSize, minChar, maxChars } = fields
    const actualSize = fieldSize !== null ? fieldSize : this._calculateSize(key, fieldValue, fields.type)

    if (maxSize && actualSize > maxSize) {
      throw new Error(`Value for ${key} exceeds maxSize ${maxSize}`)
    }

    if (minSize && actualSize < minSize) {
      throw new Error(`Value for ${key} is below minSize ${minSize}`)
    }

    if (maxChars && fieldValue.length > maxChars) {
      throw new Error(`Value for ${key} exceeds maxChars ${maxChars}`)
    }

    if (minChar && fieldValue.length < minChar) {
      throw new Error(`Value for ${key} is below minChar ${minChar}`)
    }
  }

  // Helper to calculate the size of the field
  _calculateSize (key, value, type) {
    const state = cenc.state()
    const actualType = type || key
    cenc[actualType].preencode(state, value)
    return state.end
  }

  preencode (state, val) {
    this._processFields(state, val, 'preencode')
  }

  encode (state, val) {
    this._processFields(state, val, 'encode')
  }

  decode (state) {
    return this._processFields(state, null, 'decode')
  }
}

// Function to preencode a message and get its size
const preencodeMessage = (state, message, schema) => {
  cenc.string.preencode(state, message.event)
  schema.preencode(state, message)
}

// Function to encode a message
export const encodeMessage = (message) => {
  const state = cenc.state()
  const { schema, options } = schemaRegistry[message.event]
  if (!schema) {
    console.error('Unknown event type:', message.event)
    return
  }
  if (schema.hasKey('_size')) {
    const tempState = cenc.state()
    preencodeMessage(tempState, message, schema)
    message._size = tempState.end
  }
  preencodeMessage(state, message, schema)

  // Allocate buffer and encode
  state.buffer = new Uint8Array(state.end)
  cenc.string.encode(state, message.event)
  schema.encode(state, message)

  // Check against maxSize if it's set
  if (options && options.maxSize && state.end > options.maxSize) {
    throw new Error(`Encoded message exceeds maximum size of ${options.maxSize} bytes`)
  }

  return state.buffer
}

// Function to decode a message
export const decodeMessage = (buffer) => {
  const state = cenc.state()
  state.buffer = buffer
  state.start = 0
  state.end = buffer.length

  try {
    const eventType = cenc.string.decode(state)
    const { schema, options } = schemaRegistry[eventType]

    if (!schema) {
      console.error('Unknown event type:', eventType)
      return null
    }

    // Check against maxSize if it's set
    if (options && options.maxSize && state.end > options.maxSize) {
      console.error(`Received message exceeds maximum size of ${options.maxSize} bytes`)
      return null
    }

    const message = schema.decode(state)
    return message
  } catch (e) {
    console.error('Invalid message:', e)
    return null
  }
}

// Schema Registry
const schemaRegistry = {}

// Function to create a new schema
export const createSchema = (name, fields, options = {}) => {
  const processedFields = {}
  for (const [key, field] of Object.entries(fields)) {
    if (typeof field === 'object' && !field._type) {
      processedFields[key] = new DynamicSchema(field)
    } else {
      processedFields[key] = field
    }
  }

  schemaRegistry[name] = { schema: new DynamicSchema(processedFields), options }

  return schemaRegistry[name]
}
