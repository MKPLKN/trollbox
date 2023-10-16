# P2P TR0LLB0X
Check out a live demo: https://peertopeerhub.com/trollbox - P2P Trollbox allows any user to send messages and communicate with all connected peers.

## Installation
`npm install p2p-trollbox`

## Usage
After installation, add this code snippet to the `index.js` file. Then run `node index.js` and start typing into the terminal.
``` js
import { Trollbox } from 'p2p-trollbox'

const trollbox = new Trollbox()

// Listen to other peers' messages
trollbox.on('connectionData', (stream, data) => {
  console.log(trollbox.decodeMessage(data))
})

// Send a message to all peers
process.stdin.on('data', (d) => {
  trollbox.sendMessage(d.toString())
})
```


> **Note:** 👆 The code above is all you need to connect to the P2P network and send/receive data. If you run this on your local machine, you join the same P2P network with https://peertopeerhub.com/trollbox. Messages sent from your terminal are visible to anyone on the site's UI.
> 
> **Note:** 👇 Using it as a relay/client is **only relevant if** you intend to add a relay to your P2P network, which is useful for browser-based user access.



## Usage As A Relay
This is how the trollbox's relay is set up server-side at https://peertopeerhub.com/trollbox
``` js
import { Trollbox } from 'p2p-trollbox'

const trollbox = new Trollbox({
  isRelay: true,
});

// Listen to other peers' messages
trollbox.on('connectionData', (stream, data) => {
  console.log(trollbox.decodeMessage(data))
})

// Send a message to all peers
process.stdin.on('data', (d) => {
  trollbox.sendMessage(d.toString())
})
```

## Usage As A Client
Before you set up a client, you should have a relay server ready 👆

This is how the trollbox's client-side is set-up in https://peertopeerhub.com/trollbox
``` js
import { TrollboxClient } from "p2p-trollbox";

const trollbox = new TrollboxClient();

// Get the relay server's key
trollbox.serverKey().then((key) => {
  const dhtSocket = trollbox.connect(key);

  dhtSocket.on("connect", () => {
    console.log("Client connected!");
  });

  // Listen to other peers' messages
  dhtSocket.on("data", (data) => {
    const msg = trollbox.decodeMessage(data);
    console.log(msg)
  })
})

// Broadcast any message to the P2P network
const msg = trollbox.newMessageStruct("Hello!");
trollbox.sendMessage(msg);
```
