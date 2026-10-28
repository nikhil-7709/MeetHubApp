/**
 * MeetHub Real-Time WebRTC Signaling Server
 * Relays WebRTC SDP offers, answers, ICE candidates, and chat messages between devices.
 * Run with: node scripts/signaling-server.js
 */

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8082;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ status: 'ok', name: 'MeetHub Signaling Server', port: PORT }));
});

const wss = new WebSocket.Server({ server });

// Map: meetingId -> Set of client WebSockets
const rooms = new Map();

wss.on('connection', (ws, req) => {
  let currentRoom = null;
  let currentPeerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { meetingId, senderId, targetId } = msg;

      if (meetingId && !currentRoom) {
        currentRoom = meetingId;
        currentPeerId = senderId;
        if (!rooms.has(meetingId)) {
          rooms.set(meetingId, new Set());
        }
        rooms.get(meetingId).add(ws);
      }

      // Relay to clients in the same room
      if (currentRoom && rooms.has(currentRoom)) {
        const clients = rooms.get(currentRoom);
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            // If targetId is specified, only send to that target if attached, else broadcast
            client.send(JSON.stringify(msg));
          }
        });
      }
    } catch (err) {
      console.error('Signaling error:', err.message);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const clients = rooms.get(currentRoom);
      clients.delete(ws);
      if (clients.size === 0) {
        rooms.delete(currentRoom);
      } else {
        // Notify others that peer left
        const leaveMsg = JSON.stringify({
          type: 'leave',
          meetingId: currentRoom,
          senderId: currentPeerId,
          timestamp: Date.now(),
        });
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(leaveMsg);
          }
        });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MeetHub WebRTC Signaling Server listening on ws://0.0.0.0:${PORT}`);
  console.log(`   Devices on the same network can connect for real audio/video calling.\n`);
});
