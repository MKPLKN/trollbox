import b4a from 'b4a'

export const getSwarmSummary = (swarm) => ({
  publicKey: toHex(swarm?.keyPair?.publicKey),
  dht: {
    publicKey: toHex(swarm?.dht?.defaultKeyPair?.publicKey),
    bootstrapNodes: swarm?.dht?.bootstrapNodes
  },
  server: {
    target: toHex(swarm?.server?.target),
    publicKey: toHex(swarm?.server?._keyPair?.publicKey),
    announcer: {
      target: toHex(swarm?.server?._announcer?.target),
      record: toHex(swarm?.server?._announcer?.record)
    }
  },
  connections: Array.from(swarm?.connections || []).map(noiseStream => ({
    publicKey: toHex(noiseStream?.publicKey),
    remotePublicKey: toHex(noiseStream?.remotePublicKey),
    UDXStream: udxInfo(noiseStream?._rawStream)
  })),
  peers: Array.from(swarm.peers.values()).map(obj => ({
    publicKey: toHex(obj?.publicKey),
    topics: obj.topics.map(t => toHex(t))
  })),
  peerDiscovery: Array.from(swarm._discovery.values()).map(obj => ({
    topic: toHex(obj?.topic)
  })),
  allConnections: Array.from(swarm._allConnections).map(noiseStream => ({
    publicKey: toHex(noiseStream?.publicKey),
    remotePublicKey: toHex(noiseStream?.remotePublicKey),
    UDXStream: udxInfo(noiseStream?._rawStream)
  }))
})

export const getSummary = (noiseStream, peerInfo) => ({
  publicKey: toHex(noiseStream?.publicKey),
  remotePublicKey: toHex(noiseStream?.remotePublicKey),
  UDXStream: udxInfo(noiseStream?._rawStream),
  peerInfo: {
    publicKey: toHex(peerInfo?.publicKey)
  }
})

export const udxInfo = (udxStream) => ({
  id: udxStream?.id,
  remoteId: udxStream?.remoteId,
  remoteHost: `${udxStream?.remoteHost}:${udxStream?.remotePort}`,
  remoteFamily: udxStream?.remoteFamily
})

export const toHex = (buf) =>
  buf && Buffer.isBuffer(buf) ? b4a.toString(buf, 'hex') : ''

// For generating random names
const firstNames = [
  'Alice',
  'Bob',
  'Charlie',
  'Dana',
  'Eve',
  'Frank',
  'Grace',
  'Hannah',
  'Ivan',
  'Jack',
  'Kara',
  'Lana',
  'Mike',
  'Nina',
  'Oscar',
  'Paula',
  'Quincy',
  'Rita',
  'Steve',
  'Tara'
]
const middleNames = [
  'Moon',
  'Sun',
  'Star',
  'Sky',
  'Rain',
  'Snow',
  'Cloud',
  'Storm',
  'Wind',
  'Fog',
  'Dew',
  'Hail',
  'Sleet',
  'Mist',
  'Frost',
  'Ice',
  'Sand',
  'Stone',
  'Rock',
  'Dust'
]
const lastNames = [
  'Smithers',
  'Wiggles',
  'Fluffington',
  'Sparkle',
  'Paws',
  'Whiskers',
  'Scales',
  'Feathers',
  'Furrball',
  'Chirp',
  'Squawk',
  'Flutter',
  'Waddle',
  'Quack',
  'Cluck',
  'Moo',
  'Neigh',
  'Oink',
  'Baa',
  'Roar'
]
const getRandomElement = (array) =>
  array[Math.floor(Math.random() * array.length)]

export const generateRandomName = () => {
  const firstName = getRandomElement(firstNames)
  const middleName = getRandomElement(middleNames)
  const lastName = getRandomElement(lastNames)
  return `${firstName} ${middleName} ${lastName}`
}
