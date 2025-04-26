const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server
  const wss = new WebSocket.Server({ noServer: true });

  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    // Connect to AssemblyAI WebSocket
    const assemblyWs = new WebSocket("wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000", {
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
      },
    });

    assemblyWs.on('open', () => {
      console.log('Connected to AssemblyAI');
    });

    assemblyWs.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Forward transcription data to client
        if (data.message_type === 'FinalTranscript' || data.message_type === 'PartialTranscript') {
          ws.send(JSON.stringify({ transcription: data.text }));
        }
      } catch (error) {
        console.error('Error processing AssemblyAI message:', error);
      }
    });

    // Handle messages from client
    ws.on('message', (message) => {
      if (assemblyWs.readyState === WebSocket.OPEN) {
        // Forward audio data to AssemblyAI
        assemblyWs.send(message);
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      if (assemblyWs.readyState === WebSocket.OPEN) {
        assemblyWs.close();
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    assemblyWs.on('error', (error) => {
      console.error('AssemblyAI WebSocket error:', error);
    });
  });

  // Handle upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const pathname = parse(request.url).pathname;

    if (pathname === '/api/transcribe') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});