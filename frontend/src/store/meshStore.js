import { create } from 'zustand';

const useMeshStore = create((set, get) => ({
  // ── Topology ───────────────────────────────────────────────────────────────
  nodes:             [],
  edges:             [],
  healthPercentage:  100,
  activeRoutes:      0,
  activeMeshId:      'mesh-hq',
  routingPolicy:     'latency',

  // ── Selected node ──────────────────────────────────────────────────────────
  selectedNodeId:  null,
  selectedNode:    null,
  nodeRoutes:      [],

  // ── Telemetry (per node) ───────────────────────────────────────────────────
  telemetry:        {},
  telemetryHistory: {},

  // ── Events / Alerts ────────────────────────────────────────────────────────
  events: [],
  alerts: [],

  // ── Live stats (updated from stats:update socket event) ───────────────────
  stats: {
    totalNodes:       5,
    activeNodes:      5,
    failedNodes:      0,
    networkHealth:    100,
    activeRoutes:     20,
    mqttStatus:       'CONNECTED',
    packetThroughput: 3200,
    avgLatency:       12,
    lastFailover:     null,
    activeAlerts:     0,
    threatLevel:      15,
    totalPackets:     0,
  },

  // ── Security ───────────────────────────────────────────────────────────────
  threatLevel:  15,
  attackEvents: [],
  anomalyData:  [],

  // ── Connection state ───────────────────────────────────────────────────────
  connected:       false,
  highlightedPath: [],
  optimizedPaths:  [],

  // ── Simulation state ───────────────────────────────────────────────────────
  simulating: null,

  // ── Failover animation state ───────────────────────────────────────────────
  failoverActive:   false,
  failoverNodeId:   null,
  routeHighlight:   { path: [], type: null },

  // ── Operating mode (SIMULATION / HYBRID / LIVE) ────────────────────────────
  operatingMode:  'SIMULATION',

  // ── System info ────────────────────────────────────────────────────────────
  systemUptime:   0,
  mqttStatus:     { brokerOnline: false, connectedNodes: 0, reconnects: 0, uptime: 0 },

  // ── Demo automation ────────────────────────────────────────────────────────
  demoActive:     false,
  demoStep:       null,      // { step, totalSteps, name, label, description, progress }

  // ── New Feature States ─────────────────────────────────────────────────────
  predictions: [],
  predictionsWarning: null,
  powerGrid: {},
  firmwareRegistry: [],
  firmwareBatchStatus: {},
  firmwareHistory: [],
  playbooks: [],
  playbookLogs: [],
  zones: [],
  replayFrames: [],
  replayRecording: true,
  replayPlaying: false,
  replayIndex: -1,
  replaySpeed: 1,
  slaCompliance: 100,
  slaBreaches: [],
  notificationsSettings: {
    telegramToken: '',
    telegramChatId: '',
    discordWebhookUrl: '',
    emailAlertsEnabled: false
  },
  securityKeys: [],
  securityLogs: [],
  edgeTasks: [],
  obstacles: [],

  // ── ACTIONS ────────────────────────────────────────────────────────────────

  setConnected: (connected) => set({ connected }),

  updateTopology: (snapshot) => set(state => {
    const mergedNodes = (snapshot.nodes || []).map(incoming => {
      const existing = state.nodes.find(n => n.nodeId === incoming.nodeId);
      return {
        ...existing,
        ...incoming,
        position: incoming.position || existing?.position || { x: 300, y: 300 },
      };
    });
    return {
      nodes:            mergedNodes,
      edges:            snapshot.edges || [],
      healthPercentage: snapshot.healthPercentage ?? 100,
      activeRoutes:     snapshot.activeRoutes ?? 0,
      operatingMode:    snapshot.operatingMode || state.operatingMode,
      liveCount:        snapshot.liveCount ?? 0,
      simCount:         snapshot.simCount ?? 0,
      offlineCount:     snapshot.offlineCount ?? 0,
      gatewayCount:     snapshot.gatewayCount ?? 0,
      activeMeshId:     snapshot.activeMeshId || state.activeMeshId || 'mesh-hq',
      routingPolicy:    snapshot.routingPolicy || state.routingPolicy,
      obstacles:        snapshot.obstacles || state.obstacles || [],
    };
  }),

  updateTelemetry: (data) => {
    const { nodeId } = data;
    set(state => {
      const prev = state.telemetryHistory[nodeId] || [];
      const next = [...prev, { ...data, ts: Date.now() }].slice(-50);
      return {
        telemetry:        { ...state.telemetry, [nodeId]: data },
        telemetryHistory: { ...state.telemetryHistory, [nodeId]: next },
      };
    });
  },

  updateStats: (statsData) => set(state => ({
    stats: {
      ...state.stats,
      ...statsData,
      mqttStatus: statsData.mqttStatus || state.stats.mqttStatus,
    },
    threatLevel: statsData.threatLevel ?? state.threatLevel,
  })),

  addEvent: (event) => set(state => ({
    events: [{ ...event, timestamp: event.timestamp || new Date().toISOString() }, ...state.events].slice(0, 300),
  })),

  setEvents: (events) => set({ events }),

  addAlert: (alert) => set(state => ({
    alerts: [alert, ...state.alerts].slice(0, 50),
    stats:  { ...state.stats, activeAlerts: state.stats.activeAlerts + 1 },
  })),

  setAlerts: (alerts) => set({ alerts }),

  clearAlerts: () => set(state => ({
    alerts: [],
    stats: { ...state.stats, activeAlerts: 0 }
  })),

  selectNode: (nodeId, node, routes) => set({
    selectedNodeId: nodeId,
    selectedNode:   node,
    nodeRoutes:     routes || [],
  }),

  clearSelectedNode: () => set({ selectedNodeId: null, selectedNode: null, nodeRoutes: [] }),

  updateNodeInTopology: (nodeId, updates) => set(state => ({
    nodes: state.nodes.map(n => n.nodeId === nodeId ? { ...n, ...updates } : n),
    selectedNode: state.selectedNodeId === nodeId
      ? { ...state.selectedNode, ...updates }
      : state.selectedNode,
  })),

  setHighlightedPath: (path) => set({ highlightedPath: path }),
  setOptimizedPaths:  (paths) => set({ optimizedPaths: paths }),
  setSimulating:      (sim)   => set({ simulating: sim }),

  setRouteHighlight: (path, type = null) => set({ routeHighlight: { path, type } }),
  clearRouteHighlight: () => set({ routeHighlight: { path: [], type: null } }),

  setFailoverActive: (active, nodeId = null) => set({ failoverActive: active, failoverNodeId: nodeId }),

  // Operating mode
  setOperatingMode: (mode) => set({ operatingMode: mode }),

  // System info
  setSystemUptime: (uptime) => set({ systemUptime: uptime }),
  setMqttStatus:   (status) => set({ mqttStatus: status }),

  // Demo
  setDemoActive: (active) => set({ demoActive: active }),
  setDemoStep:   (step)   => set({ demoStep: step }),

  // Security
  updateThreatLevel: (level) => set({ threatLevel: level }),

  addAnomalyPoint: (point) => set(state => ({
    anomalyData: [...state.anomalyData, point].slice(-30),
  })),

  addAttackEvent: (event) => set(state => ({
    attackEvents: [event, ...state.attackEvents].slice(0, 20),
    threatLevel:  Math.min(100, state.threatLevel + 30),
  })),

  clearThreat: () => set(state => ({
    threatLevel: Math.max(10, state.threatLevel - 40),
  })),

  // New Feature Actions
  setPredictions: (predictions) => set({ predictions }),
  setPredictionsWarning: (warning) => set({ predictionsWarning: warning }),
  setPowerGrid: (powerGrid) => set({ powerGrid }),
  updatePowerNode: (nodeId, updates) => set(state => ({
    powerGrid: {
      ...state.powerGrid,
      [nodeId]: {
        ...state.powerGrid[nodeId],
        ...updates
      }
    }
  })),
  setFirmwareState: (registry, batch, history) => set({
    firmwareRegistry: registry || [],
    firmwareBatchStatus: batch || {},
    firmwareHistory: history || []
  }),
  updateOtaProgress: (otaState) => set(state => ({
    firmwareBatchStatus: {
      ...state.firmwareBatchStatus,
      [otaState.nodeId]: otaState
    }
  })),
  setPlaybooksState: (playbooks, logs) => set({
    playbooks: playbooks || [],
    playbookLogs: logs || []
  }),
  setPlaybooks: (playbooks) => set({ playbooks }),
  addPlaybookLog: (log) => set(state => ({
    playbookLogs: [log, ...state.playbookLogs].slice(0, 100)
  })),
  setZones: (zones) => set({ zones }),
  setReplayInitState: (frames, recording) => set({
    replayFrames: frames || [],
    replayRecording: recording !== undefined ? recording : true
  }),
  setReplayState: (updates) => set(state => ({
    ...state,
    ...updates
  })),
  setSlaState: (compliance, breaches) => set(state => ({
    slaCompliance: compliance !== undefined ? compliance : state.slaCompliance,
    slaBreaches: breaches || []
  })),
  addSlaBreach: (breach) => set(state => ({
    slaBreaches: [breach, ...state.slaBreaches].slice(0, 100)
  })),
  setNotificationsSettings: (settings) => set({ notificationsSettings: settings }),
  setSecurityState: (keys, logs) => set({ securityKeys: keys || [], securityLogs: logs || [] }),
  addSecurityLog: (log) => set(state => ({
    securityLogs: [log, ...state.securityLogs].slice(0, 100)
  })),
  updateSecurityKeys: (keys) => set({ securityKeys: keys }),
  setEdgeTasks: (tasks) => set({ edgeTasks: tasks })
}));

export default useMeshStore;
