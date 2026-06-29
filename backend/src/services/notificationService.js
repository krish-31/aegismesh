/**
 * NotificationService — Telegram & Discord NOC Dispatcher with interactive callback webhook buttons
 */

const https = require('https');

class NotificationService {
  constructor() {
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN || '8251854963:AAEAJpZu5PsdEmhYTrqd44LsU0jcBiqpUF8';
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID || '1005745509';
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
    this.emailAlertsEnabled = false;

    this.cooldowns = new Map(); // key -> timestamp
    this.lastUpdateId = 0;
    this.pollingIntervalId = null;

    // Start long-polling if Telegram Bot Token is loaded
    if (this.telegramToken) {
      this.startTelegramPolling();
    }
  }

  updateSettings({ telegramToken, telegramChatId, discordWebhookUrl, emailAlertsEnabled }) {
    if (telegramToken !== undefined && telegramToken !== '********') {
      this.telegramToken = telegramToken;
      // Restart polling with new token
      this.stopTelegramPolling();
      this.startTelegramPolling();
    }
    if (telegramChatId !== undefined) this.telegramChatId = telegramChatId;
    if (discordWebhookUrl !== undefined && discordWebhookUrl !== '********') this.discordWebhookUrl = discordWebhookUrl;
    if (emailAlertsEnabled !== undefined) this.emailAlertsEnabled = emailAlertsEnabled;

    console.log('[Notifications] Configurations updated.');
  }

  getSettings() {
    return {
      telegramToken: this.telegramToken ? '********' : '',
      telegramChatId: this.telegramChatId,
      discordWebhookUrl: this.discordWebhookUrl ? '********' : '',
      emailAlertsEnabled: this.emailAlertsEnabled
    };
  }

  sendAlert(nodeId, type, message, severity = 'WARNING') {
    const key = `${nodeId}:${type}`;
    const now = Date.now();

    // CRITICAL alerts (e.g. hardware disconnected) always bypass cooldown
    // Non-critical alerts: 5-minute cooldown per node/type to prevent flood
    if (severity !== 'CRITICAL') {
      if (this.cooldowns.has(key)) {
        const lastSent = this.cooldowns.get(key);
        if (now - lastSent < 300000) return;
      }
    }

    this.cooldowns.set(key, now);
    
    const icon = severity === 'CRITICAL' ? '🚨' : '⚠️';
    const textMessage = `${icon} [AegisMesh Alert] [${severity}]\nNode: ${nodeId}\nEvent: ${type}\nDetails: ${message}\nTime: ${new Date().toLocaleTimeString()}`;

    console.log(`[Notification Dispatch] => ${severity}: Node=${nodeId} Type=${type} - "${message}"`);

    // 1. Send Telegram Alert
    if (this.telegramToken && this.telegramChatId) {
      this._dispatchTelegram(textMessage);
    }

    // 2. Send Discord Webhook
    if (this.discordWebhookUrl) {
      this._dispatchDiscord(textMessage);
    }
  }

  // Feature 24: Send Predictive Alert with Inline Keyboard confirmation
  sendPredictiveAlert(nodeId, riskScore, predictedFailureTime) {
    const key = `${nodeId}:predictive_alert`;
    const now = Date.now();

    // 5-minute cooldown per node for prediction alerts
    if (this.cooldowns.has(key)) {
      const lastSent = this.cooldowns.get(key);
      if (now - lastSent < 300000) return;
    }
    this.cooldowns.set(key, now);

    const timeStr = predictedFailureTime 
      ? new Date(predictedFailureTime).toLocaleTimeString() 
      : 'within next 5 minutes';
      
    const textMessage = `🔮 <b>[Predictive AI Warning]</b>\n` +
      `Node <b>${nodeId}</b> is predicted to fail at ${timeStr}.\n` +
      `<b>Current Risk Score:</b> ${riskScore.toFixed(0)}%\n\n` +
      `👉 <i>Remediation action is highly recommended. Select a mitigation below:</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: `🔋 Switch ${nodeId} to ECO`, callback_data: `eco_${nodeId}` },
          { text: `🔄 Trigger OTA Reboot`, callback_data: `reboot_${nodeId}` }
        ]
      ]
    };

    if (this.telegramToken && this.telegramChatId) {
      this._dispatchTelegramWithButtons(textMessage, keyboard);
    }
  }

  _dispatchTelegram(message) {
    const chatIds = String(this.telegramChatId).split(',').map(id => id.trim()).filter(Boolean);
    chatIds.forEach(chatId => {
      const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      const payload = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });

      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      });

      req.on('error', (err) => {
        console.error(`[Notifications] Telegram dispatch failure for ${chatId}:`, err.message);
      });

      req.write(payload);
      req.end();
    });
  }

  _dispatchTelegramWithButtons(message, replyMarkup) {
    const chatIds = String(this.telegramChatId).split(',').map(id => id.trim()).filter(Boolean);
    chatIds.forEach(chatId => {
      const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      const payload = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });

      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      });

      req.on('error', (err) => {
        console.error(`[Notifications] Telegram interactive dispatch failure for ${chatId}:`, err.message);
      });

      req.write(payload);
      req.end();
    });
  }

  // ── Telegram Long Polling update retrieval ───────────────────────────────
  startTelegramPolling() {
    if (this.pollingIntervalId) return;
    console.log('[Notifications] Starting Telegram interactive update polling...');
    this.pollingIntervalId = setInterval(() => this._pollTelegramUpdates(), 3000);
  }

  stopTelegramPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  _pollTelegramUpdates() {
    if (!this.telegramToken) return;
    
    const url = `https://api.telegram.org/bot${this.telegramToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=0`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.ok && body.result) {
            body.result.forEach(update => {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
              this._processTelegramUpdate(update);
            });
          }
        } catch (err) {
          // parse error
        }
      });
    }).on('error', (err) => {
      // network/timeout error
    });
  }

  _processTelegramUpdate(update) {
    const allowedChatIds = String(this.telegramChatId).split(',').map(id => id.trim()).filter(Boolean);

    // ── 1. Button callback (eco/reboot inline buttons) ────────────────────
    if (update.callback_query) {
      const cb     = update.callback_query;
      const data   = cb.data;
      const chatId = cb.message.chat.id;
      const parts  = data.split('_');

      // Verify authorization for callback button presses
      if (!allowedChatIds.includes(String(chatId))) {
        this._dispatchTelegramText('⛔ Unauthorized chat.', chatId);
        this._answerCallbackQuery(cb.id);
        return;
      }

      if (parts.length >= 2) {
        const action = parts[0];
        const nodeId = parts.slice(1).join('_');
        const powerService = require('./powerService');
        const otaService   = require('./otaService');

        let responseText = '';
        if (action === 'eco') {
          powerService.setMode(nodeId, 'ECO');
          responseText = `🔋 Node <b>${nodeId}</b> switched to ECO Mode ✅`;
        } else if (action === 'reboot') {
          otaService.startUpdate(nodeId, 'v1.1');
          responseText = `🔄 OTA reboot triggered on <b>${nodeId}</b> ✅`;
        }
        if (responseText) this._dispatchTelegramText(responseText, chatId);
      }
      this._answerCallbackQuery(cb.id);
      return;
    }

    // ── 2. Text commands ──────────────────────────────────────────────────
    if (!update.message || !update.message.text) return;

    const chatId  = update.message.chat.id;
    const rawText = update.message.text.trim();
    const text    = rawText.toLowerCase();

    // Only respond to registered chats (security)
    if (!allowedChatIds.includes(String(chatId))) {
      this._dispatchTelegramText('⛔ Unauthorized chat.', chatId);
      return;
    }

    const topology       = require('./topologyService');
    const historyService = require('./historyService');

    // ── /help ──────────────────────────────────────────────────────────
    if (text === '/help' || text === '/start') {
      const msg =
        `🛰 <b>AegisMesh NOC Bot</b>\n\n` +
        `Available commands:\n\n` +
        `📡 <b>/status</b> — Overall mesh health\n` +
        `🖥 <b>/nodes</b> — List all nodes\n` +
        `🔍 <b>/node ESP32-A</b> — Details of a specific node\n` +
        `📊 <b>/telemetry ESP32-A</b> — Latest sensor data\n` +
        `🌐 <b>/mesh</b> — Active mesh info\n` +
        `⚠️ <b>/alerts</b> — Recent failover events\n` +
        `📈 <b>/uptime</b> — Node uptime rankings\n` +
        `💡 <b>/failovers</b> — Failover log\n` +
        `🔋 <b>/power</b> — Power states of all nodes`;
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /status ────────────────────────────────────────────────────────
    if (text === '/status') {
      const snap   = topology.getTopologySnapshot();
      const online = snap.nodes.filter(n => n.status !== 'failed').length;
      const failed = snap.nodes.filter(n => n.status === 'failed').length;
      const msg =
        `🛰 <b>AegisMesh Mesh Status</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🟢 Nodes Online: <b>${online}</b>\n` +
        `🔴 Nodes Failed: <b>${failed}</b>\n` +
        `💚 Mesh Health: <b>${snap.healthPercentage}%</b>\n` +
        `📡 Active Routes: <b>${snap.activeRoutes}</b>\n` +
        `⚡ Avg Latency: <b>${snap.avgLatency} ms</b>\n` +
        `📦 Total Packets: <b>${snap.totalPackets.toLocaleString()}</b>\n` +
        `🔁 Mode: <b>${snap.operatingMode}</b>\n` +
        `⏱ Uptime: <b>${snap.systemUptime}s</b>`;
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /nodes ─────────────────────────────────────────────────────────
    if (text === '/nodes') {
      const nodes = topology.getAllNodes();
      const statusIcon = s => s === 'healthy' ? '🟢' : s === 'failed' ? '🔴' : s === 'gateway' ? '🔵' : '🟡';
      const modeTag    = n => n.isReal ? ' [HW]' : ' [SIM]';
      let msg = `🖥 <b>All Mesh Nodes (${nodes.length})</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      nodes.forEach(n => {
        msg += `${statusIcon(n.status)} <b>${n.nodeId}</b>${modeTag(n)} — ${n.status.toUpperCase()}\n`;
        msg += `   📶 ${n.latency || 0}ms | CPU: ${(n.cpuUsage || 0).toFixed(0)}% | IP: ${n.ipAddress}\n`;
      });
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /node (usage) ──────────────────────────────────────────────────
    if (text === '/node') {
      const nodes = topology.getAllNodes();
      let msg = `❌ <b>Please specify a Node ID.</b>\n━━━━━━━━━━━━━━━━━━━━\nUsage: <code>/node &lt;ID&gt;</code>\n\nActive Nodes:\n`;
      nodes.forEach(n => {
        msg += `• <code>/node ${n.nodeId}</code>\n`;
      });
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /node <id> ─────────────────────────────────────────────────────
    if (text.startsWith('/node ')) {
      const nodeId = rawText.slice(6).trim().toUpperCase();
      const node   = topology.getNode(nodeId);
      if (!node) return this._dispatchTelegramText(`❌ Node <b>${nodeId}</b> not found.\nUse /nodes to see all node IDs.`, chatId);

      const statusIcon = node.status === 'healthy' ? '🟢' : node.status === 'failed' ? '🔴' : '🟡';
      const msg =
        `🔍 <b>Node: ${node.nodeId}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${statusIcon} Status: <b>${node.status.toUpperCase()}</b>\n` +
        `🏷 Label: ${node.label}\n` +
        `📡 Mode: ${node.isReal ? '● LIVE [HW]' : '◌ SIMULATED'}\n` +
        `🌐 IP: ${node.ipAddress}\n` +
        `⚡ Latency: <b>${node.latency || 0} ms</b>\n` +
        `🧠 CPU: <b>${(node.cpuUsage || 0).toFixed(1)}%</b>\n` +
        `📶 WiFi RSSI: <b>${node.wifiSignal || 'N/A'} dBm</b>\n` +
        `📦 Packets: <b>${(node.packetCount || 0).toLocaleString()}</b>\n` +
        `⏱ Uptime: <b>${node.uptime || 0}s</b>\n` +
        `🔒 Anomaly Score: <b>${(node.anomalyScore || 0).toFixed(0)}</b>\n` +
        `🔥 Firmware: ${node.firmwareVersion || 'N/A'}`;

      const keyboard = node.isGateway ? null : {
        inline_keyboard: [[
          { text: `🔋 ECO Mode`, callback_data: `eco_${nodeId}` },
          { text: `🔄 OTA Reboot`, callback_data: `reboot_${nodeId}` },
        ]]
      };
      return keyboard
        ? this._dispatchTelegramWithButtons(msg, keyboard)
        : this._dispatchTelegramText(msg, chatId);
    }

    // ── /telemetry (usage) ─────────────────────────────────────────────
    if (text === '/telemetry') {
      const nodes = topology.getAllNodes();
      let msg = `❌ <b>Please specify a Node ID.</b>\n━━━━━━━━━━━━━━━━━━━━\nUsage: <code>/telemetry &lt;ID&gt;</code>\n\nActive Nodes:\n`;
      nodes.forEach(n => {
        msg += `• <code>/telemetry ${n.nodeId}</code>\n`;
      });
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /telemetry <id> ────────────────────────────────────────────────
    if (text.startsWith('/telemetry ')) {
      const nodeId = rawText.slice(11).trim().toUpperCase();
      const node   = topology.getNode(nodeId);
      if (!node) return this._dispatchTelegramText(`❌ Node <b>${nodeId}</b> not found.`, chatId);
      const t = node.telemetry || {};
      const msg =
        `📊 <b>Telemetry: ${nodeId}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🌡 Temperature: <b>${(t.temperature || 0).toFixed(1)} °C</b>\n` +
        `💧 Humidity: <b>${(t.humidity || 0).toFixed(1)} %</b>\n` +
        `☁️ Gas Level: <b>${(t.gasLevel || 0).toFixed(0)} ppm</b>\n` +
        `🔋 Battery: <b>${t.batteryLevel || 100}%</b>\n` +
        `🌐 Network Load: <b>${(t.networkLoad || 0).toFixed(1)}%</b>\n` +
        `🚶 Motion: <b>${t.motionDetected ? 'DETECTED' : 'None'}</b>\n` +
        `⚡ Power: <b>${t.powerStatus || 'normal'}</b>\n` +
        `🕒 At: ${t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : 'N/A'}`;
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /mesh ──────────────────────────────────────────────────────────
    if (text === '/mesh') {
      const snap = topology.getTopologySnapshot();
      const msg =
        `🌐 <b>Active Mesh Info</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 Mesh ID: <b>${snap.activeMeshId}</b>\n` +
        `🔁 Mode: <b>${snap.operatingMode}</b>\n` +
        `📡 Routing: <b>${snap.routingPolicy}</b>\n` +
        `🟢 Live HW Nodes: <b>${snap.liveCount}</b>\n` +
        `🔵 Simulated Nodes: <b>${snap.simCount}</b>\n` +
        `🔴 Offline: <b>${snap.offlineCount}</b>\n` +
        `🛡 Gateways: <b>${snap.gatewayCount}</b>`;
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /alerts ────────────────────────────────────────────────────────
    if (text === '/alerts') {
      const report   = historyService.getReportData();
      const recent   = report.failoverSummary?.recent || [];
      if (recent.length === 0) return this._dispatchTelegramText('✅ No recent failover events.', chatId);
      let msg = `⚠️ <b>Recent Failover Events</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      recent.slice(0, 5).forEach((f, i) => {
        msg += `${i + 1}. 🔴 <b>${f.failedNode}</b>\n`;
        msg += `   📍 Route: ${(f.newRoute || []).join(' → ')}\n`;
        msg += `   ⏱ Duration: ${f.duration || 0}ms | ${f.success ? '✅ Success' : '❌ Failed'}\n`;
        msg += `   🕒 ${new Date(f.timestamp).toLocaleString()}\n\n`;
      });
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /uptime ────────────────────────────────────────────────────────
    if (text === '/uptime') {
      const report  = historyService.getReportData();
      const ranking = report.reliabilityRanking || [];
      let msg = `📈 <b>Node Uptime Rankings</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      ranking.forEach((n, i) => {
        const bar = '█'.repeat(Math.floor(n.uptime / 10)) + '░'.repeat(10 - Math.floor(n.uptime / 10));
        msg += `${i + 1}. <b>${n.nodeId}</b>  ${n.uptime.toFixed(2)}%\n   ${bar}\n`;
      });
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /failovers ─────────────────────────────────────────────────────
    if (text === '/failovers') {
      const report = historyService.getReportData();
      const { total, successful, failed, successRate } = report.failoverSummary || {};
      const msg =
        `💡 <b>Failover Summary</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 Total Failovers: <b>${total || 0}</b>\n` +
        `✅ Successful: <b>${successful || 0}</b>\n` +
        `❌ Failed: <b>${failed || 0}</b>\n` +
        `📈 Success Rate: <b>${successRate || 100}%</b>`;
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── /power ─────────────────────────────────────────────────────────
    if (text === '/power') {
      const powerService = require('./powerService');
      const nodes = topology.getAllNodes().filter(n => !n.isGateway);
      let msg = `🔋 <b>Node Power States</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      nodes.forEach(n => {
        const pw = powerService.getNodePower(n.nodeId);
        const bat = pw ? pw.battery.toFixed(0) : '?';
        const mode = pw ? pw.mode : 'NORMAL';
        const icon = bat > 50 ? '🟢' : bat > 20 ? '🟡' : '🔴';
        msg += `${icon} <b>${n.nodeId}</b> — ${mode} | 🔋 ${bat}%\n`;
      });
      return this._dispatchTelegramText(msg, chatId);
    }

    // ── Unknown command ────────────────────────────────────────────────
    if (text.startsWith('/')) {
      this._dispatchTelegramText(`❓ Unknown command: <code>${rawText}</code>\n\nSend /help to see all commands.`, chatId);
    }
  }

  _dispatchTelegramText(message, chatId) {
    const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    });
    req.write(payload);
    req.end();
  }

  _answerCallbackQuery(callbackQueryId) {
    const url = `https://api.telegram.org/bot${this.telegramToken}/answerCallbackQuery`;
    const payload = JSON.stringify({
      callback_query_id: callbackQueryId
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    });
    req.write(payload);
    req.end();
  }

  _dispatchDiscord(message) {
    const payload = JSON.stringify({
      content: message
    });

    try {
      const urlObj = new URL(this.discordWebhookUrl);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      });

      req.on('error', (err) => {
        console.error('[Notifications] Discord webhook dispatch failure:', err.message);
      });

      req.write(payload);
      req.end();
    } catch (e) {
      console.error('[Notifications] Invalid Discord Webhook URL:', e.message);
    }
  }
}

module.exports = new NotificationService();
