import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import useMeshStore from '../store/meshStore';
import { playNodeFailedSound, playNodeRecoveredSound } from '../lib/alertSounds';

export function useSocket() {
  const socket      = getSocket();
  const store       = useMeshStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // ── Connection ──────────────────────────────────────────────────────────
    socket.on('connect', () => {
      store.setConnected(true);
      socket.emit('topology:request');
      socket.emit('system:request-info');
    });
    socket.on('disconnect', () => store.setConnected(false));
    if (socket.connected) {
      store.setConnected(true);
      socket.emit('topology:request');
      socket.emit('system:request-info');
    }

    // ── Topology ────────────────────────────────────────────────────────────
    socket.on('topology:init',   (snap) => store.updateTopology(snap));
    socket.on('topology:update', (snap) => store.updateTopology(snap));

    // ── Live stats ──────────────────────────────────────────────────────────
    socket.on('stats:update', (stats) => store.updateStats(stats));

    // ── Telemetry ───────────────────────────────────────────────────────────
    socket.on('telemetry:update', (data) => store.updateTelemetry(data));

    // ── Events ──────────────────────────────────────────────────────────────
    socket.on('events:init', (events) => store.setEvents(events));
    socket.on('event:new',   (event)  => store.addEvent(event));

    // ── Alerts ──────────────────────────────────────────────────────────────
    socket.on('alert:new', (alert) => store.addAlert(alert));
    socket.on('alerts:cleared', () => store.clearAlerts());

    // ── Node state transitions ───────────────────────────────────────────────
    socket.on('node:failed', ({ nodeId, label }) => {
      store.updateNodeInTopology(nodeId, { status: 'failed' });
      store.addEvent({
        type: 'NODE_FAILED', severity: 'CRITICAL',
        message: `⚠ ${label || nodeId} went OFFLINE`, nodeId,
        timestamp: new Date().toISOString(),
      });
      store.setFailoverActive(true, nodeId);
      playNodeFailedSound();
    });

    socket.on('node:recovered', ({ nodeId, label }) => {
      store.updateNodeInTopology(nodeId, { status: 'healthy' });
      store.addEvent({
        type: 'NODE_RECOVERED', severity: 'INFO',
        message: `✓ ${label || nodeId} reconnected to mesh`, nodeId,
        timestamp: new Date().toISOString(),
      });
      store.setFailoverActive(false);
      playNodeRecoveredSound();
    });

    socket.on('node:unstable', ({ nodeId }) => {
      store.updateNodeInTopology(nodeId, { status: 'unstable' });
    });

    // ── Failover flow ────────────────────────────────────────────────────────
    socket.on('failover:started', ({ nodeId }) => {
      store.setSimulating(`failover:${nodeId}`);
      store.setFailoverActive(true, nodeId);
    });

    socket.on('failover:complete', ({ nodeId, newRoute, duration }) => {
      store.setSimulating(null);
      store.setFailoverActive(false);
      if (newRoute && newRoute.length > 0) {
        store.setRouteHighlight(newRoute, 'failover');
        store.setHighlightedPath(newRoute);
        setTimeout(() => {
          store.clearRouteHighlight();
          store.setHighlightedPath([]);
        }, 6000);
      }
      store.updateStats({ lastFailover: new Date().toISOString() });
    });

    // ── Route highlight ──────────────────────────────────────────────────────
    socket.on('route:highlighted', ({ path, type }) => {
      store.setRouteHighlight(path, type);
      store.setHighlightedPath(path);
      const duration = type === 'failover' ? 6000 : 5000;
      setTimeout(() => {
        store.clearRouteHighlight();
        store.setHighlightedPath([]);
      }, duration);
    });

    socket.on('routes:optimized', ({ paths }) => {
      store.setOptimizedPaths(paths);
      store.setSimulating(null);
      if (paths && paths.length > 0) {
        store.setHighlightedPath(paths[0]);
        setTimeout(() => {
          store.setOptimizedPaths([]);
          store.setHighlightedPath([]);
        }, 5000);
      }
    });

    // ── Security / Threats ───────────────────────────────────────────────────
    socket.on('threat:attack', (data) => {
      store.addAttackEvent({ ...data, timestamp: new Date().toISOString() });
    });

    socket.on('threat:cleared', () => {
      store.clearThreat();
    });

    // ── Node details response ────────────────────────────────────────────────
    socket.on('node:details:response', ({ node, routes }) => {
      store.selectNode(node.nodeId, node, routes);
    });

    // ── System info ──────────────────────────────────────────────────────────
    socket.on('system:mode', ({ mode }) => {
      store.setOperatingMode(mode);
    });

    socket.on('system:uptime', ({ uptime }) => {
      store.setSystemUptime(uptime);
    });

    socket.on('mqtt:status', (status) => {
      store.setMqttStatus(status);
    });

    // ── Prediction Engine listeners ──────────────────────────────────────────
    socket.on('prediction:init', (nodesReport) => {
      store.setPredictions(nodesReport);
    });
    socket.on('prediction:update', ({ nodes }) => {
      store.setPredictions(nodes);
    });
    socket.on('prediction:warning', (warning) => {
      store.setPredictionsWarning(warning);
      store.addAlert({
        _id: Date.now() + Math.random(),
        type: 'AI_PREDICTION_WARNING',
        nodeId: warning.nodeId,
        severity: 'WARNING',
        description: `🔮 Predictive Engine: ${warning.nodeId} failure forecast at ${new Date(warning.predictedFailureTime).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} (Risk: ${warning.riskScore}%)`,
        timestamp: warning.timestamp
      });
    });

    // ── Power Management listeners ───────────────────────────────────────────
    socket.on('power:init', (powerGrid) => {
      store.setPowerGrid(powerGrid);
    });
    socket.on('power:update', (powerGrid) => {
      store.setPowerGrid(powerGrid);
    });
    socket.on('power:change', ({ nodeId, mode, battery }) => {
      store.updatePowerNode(nodeId, { mode, battery });
    });
    socket.on('power:critical', ({ nodeId, battery }) => {
      store.addAlert({
        _id: Date.now() + Math.random(),
        type: 'POWER_CRITICAL',
        nodeId,
        severity: 'WARNING',
        description: `⚡ Battery critical on ${nodeId}: ${battery.toFixed(1)}% remaining`,
        timestamp: new Date().toISOString()
      });
    });
    socket.on('power:dead', ({ nodeId }) => {
      store.addAlert({
        _id: Date.now() + Math.random(),
        type: 'POWER_DEPLETED',
        nodeId,
        severity: 'CRITICAL',
        description: `💀 Battery depleted on ${nodeId}. Node offline.`,
        timestamp: new Date().toISOString()
      });
    });

    // ── OTA Firmware listeners ───────────────────────────────────────────────
    socket.on('ota:init', ({ registry, batch, history }) => {
      store.setFirmwareState(registry, batch, history);
    });
    socket.on('ota:progress', (otaState) => {
      store.updateOtaProgress(otaState);
    });
    socket.on('ota:complete', ({ nodeId, version }) => {
      store.updateNodeInTopology(nodeId, { firmwareVersion: version });
      store.addEvent({
        type: 'OTA_COMPLETE',
        severity: 'INFO',
        message: `✓ OTA Firmware upgrade complete on ${nodeId}: version ${version}`,
        nodeId,
        timestamp: new Date().toISOString()
      });
    });
    socket.on('ota:failed', ({ nodeId, reason }) => {
      store.addAlert({
        _id: Date.now() + Math.random(),
        type: 'OTA_FAILED',
        nodeId,
        severity: 'WARNING',
        description: `❌ OTA firmware upgrade failed on ${nodeId}: ${reason}`,
        timestamp: new Date().toISOString()
      });
    });

    // ── Playbooks listeners ──────────────────────────────────────────────────
    socket.on('playbooks:init', ({ playbooks, logs }) => {
      store.setPlaybooksState(playbooks, logs);
    });
    socket.on('playbooks:update', (playbooks) => {
      store.setPlaybooks(playbooks);
    });
    socket.on('playbook:triggered', (log) => {
      store.addPlaybookLog(log);
      store.addEvent({
        type: 'PLAYBOOK_TRIGGERED',
        severity: 'WARNING',
        message: `🤖 Playbook "${log.playbookName}" triggered for ${log.nodeId}: ${log.details}`,
        nodeId: log.nodeId,
        timestamp: log.timestamp
      });
    });

    // ── Zones listeners ──────────────────────────────────────────────────────
    socket.on('zones:init', (zones) => {
      store.setZones(zones);
    });
    socket.on('zones:update', (zones) => {
      store.setZones(zones);
    });

    // ── Replay listeners ─────────────────────────────────────────────────────
    socket.on('replay:init', ({ frames, recording }) => {
      store.setReplayInitState(frames, recording);
    });
    socket.on('replay:recorded', ({ totalFrames }) => {
      store.setReplayState({ replayFrames: Array(totalFrames).fill({}) });
    });
    socket.on('replay:frame', ({ index, frame }) => {
      store.setReplayState({ replayIndex: index });
      store.updateTopology(frame.snapshot);
    });
    socket.on('replay:state', ({ isPlaying, speed, currentIndex }) => {
      store.setReplayState({ replayPlaying: isPlaying, replaySpeed: speed, replayIndex: currentIndex });
    });
    socket.on('replay:finished', () => {
      store.setReplayState({ replayPlaying: false, replayIndex: -1 });
    });

    // ── SLA Compliance listeners ─────────────────────────────────────────────
    socket.on('sla:init', ({ breachLog }) => {
      store.setSlaState(undefined, breachLog);
    });
    socket.on('sla:update', ({ globalCompliance, breaches }) => {
      store.setSlaState(globalCompliance, breaches);
    });
    socket.on('sla:breach', (breach) => {
      store.addSlaBreach(breach);
      store.addAlert({
        _id: Date.now() + Math.random(),
        type: 'SLA_BREACH',
        nodeId: breach.nodeId,
        severity: breach.type,
        description: `📋 SLA Breach: ${breach.message}`,
        timestamp: breach.timestamp
      });
    });

    // ── Notifications settings listeners ─────────────────────────────────────
    socket.on('notifications:init', (settings) => {
      store.setNotificationsSettings(settings);
    });

    // ── Security / Zero-Trust ────────────────────────────────────────────────
    socket.on('security:init', ({ keys, logs }) => {
      store.setSecurityState(keys, logs);
    });
    socket.on('security:update', ({ keys }) => {
      store.updateSecurityKeys(keys);
    });
    socket.on('security:log', (log) => {
      store.addSecurityLog(log);
    });

    // ── Edge Computing ───────────────────────────────────────────────────────
    socket.on('edge:tasks:update', (tasks) => {
      store.setEdgeTasks(tasks);
    });

    // ── Demo automation ──────────────────────────────────────────────────────
    socket.on('demo:started', () => {
      store.setDemoActive(true);
    });

    socket.on('demo:step', (step) => {
      store.setDemoStep(step);
    });

    socket.on('demo:complete', () => {
      store.setDemoActive(false);
      store.setDemoStep(null);
    });

    socket.on('demo:stopped', () => {
      store.setDemoActive(false);
      store.setDemoStep(null);
    });

    // ── Error feedback ───────────────────────────────────────────────────────
    socket.on('simulation:error', ({ message }) => {
      store.addEvent({
        type: 'SIM_ERROR', severity: 'WARNING',
        message: `Simulation: ${message}`, nodeId: 'GW-001',
        timestamp: new Date().toISOString(),
      });
    });

    return () => {};
  }, []);

  return socket;
}

export default useSocket;
