/**
 * AegisMesh Backend Entry Point v3
 * Express + Socket.IO + Embedded Aedes MQTT Broker + Demo Engine
 *
 * Architecture:
 *   Express (REST) → Socket.IO (realtime) → MQTT Bridge (ESP32) → MockData (sim)
 */

require('dotenv').config();
const express          = require('express');
const http             = require('http');
const { Server }       = require('socket.io');
const cors             = require('cors');

const apiRouter        = require('./routes/api');
const socketHandlers   = require('./socket/socketHandlers');
const mockDataService  = require('./services/mockDataService');
const heartbeatService = require('./services/heartbeatService');
const mqttBridge       = require('./services/mqttBridge');
const demoService      = require('./services/demoService');

const PORT = process.env.PORT || 4000;

// ── Express app ───────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'AegisMesh Backend Online', timestamp: new Date() }));

// REST API
app.use('/api', apiRouter);

// Swagger API Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AegisMesh API Docs',
      version: '3.0.0',
      description: 'REST API documentation for AegisMesh NOC Platform',
    },
    servers: [{ url: 'http://localhost:4000' }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

socketHandlers(io);
mockDataService.setIO(io);
mqttBridge.setIO(io);
demoService.setIO(io);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║       AegisMesh v3 — ENTERPRISE NOC ONLINE        ║');
  console.log(`║       http://localhost:${PORT}                        ║`);
  console.log('║                                                    ║');
  console.log('║  ▸ Express REST API       ✓                        ║');
  console.log('║  ▸ Socket.IO Realtime     ✓                        ║');
  console.log('║  ▸ MQTT Broker (Aedes)    ✓  :1883                 ║');
  console.log('║  ▸ Simulation Engine      ✓                        ║');
  console.log('║  ▸ Demo Automation        ✓                        ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');

  // Start services in order
  mqttBridge.start();
  mockDataService.start();

  if (heartbeatService && heartbeatService.start) {
    heartbeatService.setIO(io);
    heartbeatService.start();
  }

  console.log('[Backend] ✓ All services running');
  console.log('[MQTT]    ✓ Awaiting ESP32 hardware on mqtt://localhost:1883');
  console.log('[Demo]    ✓ Auto-demo available via socket "demo:start"');
});

// Graceful shutdown
process.on('SIGTERM', () => { mockDataService.stop(); server.close(); });
process.on('SIGINT',  () => { mockDataService.stop(); server.close(); process.exit(0); });
