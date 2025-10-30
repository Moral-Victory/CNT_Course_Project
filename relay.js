import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';

async function startRelayNode() {
  try {
    const node = await createLibp2p({
      addresses: {
        listen: [
          '/ip4/0.0.0.0/tcp/4002',
          '/ip4/0.0.0.0/tcp/4003/ws'
        ]
      },
      transports: [
        tcp(),
        webSockets()
      ],
      connectionEncrypters: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      services: {
        identify: identify(),
        relay: circuitRelayServer({
          reservations: {
            maxReservations: 100,
            reservationTtl: 3600
          }
        })
      }
    });

    await node.start();
    
    console.log('🚀 libp2p Relay Node Started');
    console.log(`Peer ID: ${node.peerId.toString()}`);
    console.log('Listening on:');
    node.getMultiaddrs().forEach((ma) => {
      console.log(`  ${ma.toString()}`);
    });

    // Handle connection events
    node.addEventListener('peer:connect', (evt) => {
      console.log(`✅ Peer connected: ${evt.detail.toString()}`);
    });

    node.addEventListener('peer:disconnect', (evt) => {
      console.log(`❌ Peer disconnected: ${evt.detail.toString()}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Shutting down relay node...');
      await node.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down relay node...');
      await node.stop();
      process.exit(0);
    });

  } catch (err) {
    console.error('Failed to start relay node:', err);
    process.exit(1);
  }
}

startRelayNode();
