# 🛡️ AegisMesh: Enterprise-Grade Self-Healing IoT Mesh NOC

AegisMesh is a comprehensive, state-of-the-art Network Operations Center (NOC) platform designed for large-scale, self-healing IoT mesh networks. Featuring interactive visual topology, real-time command terminal, predictive AI failure forecast, and autonomous playbook remediation, it demonstrates advanced industrial IoT operations in a sleek, dark cyberpunk UI.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### One-Command Start
Run the automation script from the root directory to launch both the backend and frontend:
```bash
chmod +x start.sh && ./start.sh
```

### Manual Individual Boot
If you prefer running the components in separate terminal windows:
```bash
# Boot the Backend Server (Port 4000)
cd backend
npm install
node src/app.js

# Boot the Frontend Client (Port 5173)
cd ../frontend
npm install
npm run dev
```

- **Dashboard Interface:** `http://localhost:5173`
- **Backend API Server:** `http://localhost:4000`
- **Interactive Swagger Documentation:** `http://localhost:4000/api-docs`

---

## 🏗️ Project Architecture

The system is organized into modular service components:

```
aegismesh/
├── backend/                    # Node.js + Express + Socket.IO + MQTT
│   └── src/
│       ├── app.js              # Server entry point with Swagger configurations
│       ├── routes/
│       │   └── api.js          # Unified REST API router (18+ endpoints)
│       ├── services/           # Service Singletons (Business Logic Layer)
│       │   ├── topologyService.js    # Graph structure, Dijkstra engine, Mesh switching
│       │   ├── failoverService.js    # Automates node healing & failovers
│       │   ├── predictionService.js  # EWMA anomalies & linear regression risk calculations
│       │   ├── historyService.js     # Telemetry ring buffer history compiler
│       │   ├── commandService.js     # Monospace CLI prompt interpreter
│       │   ├── otaService.js         # Staged firmware upgrade transitions
│       │   ├── powerService.js       # Battery consumption & solar recharge simulator
│       │   ├── playbookService.js    # Rule engine for auto-remediation triggers
│       │   ├── zoneService.js        # logical layout coordinates manager
│       │   ├── replayService.js      # Circular buffer frame recorder (NOC DVR)
│       │   ├── slaService.js         # Network SLA target checker
│       │   ├── capacityService.js    # Growth bottleneck simulator
│       │   ├── notificationService.js# Discord / Telegram dispatch channel
│       │   ├── firebaseService.js    # Realtime DB sync with local fallback
│       │   └── mockDataService.js    # Simulates continuous ticks
│       └── socket/
│           └── socketHandlers.js     # Multiplexed event controllers
└── frontend/                   # Vite React Client
    ├── public/
    │   ├── manifest.json       # PWA Application manifest
    │   └── sw.js               # Service Worker for asset caching
    └── src/
        ├── components/         # Modular dashboard cards & widgets
        ├── pages/              # Responsive layout dashboard sheets
        ├── store/
        │   └── meshStore.js    # Unified Zustand client state
        └── hooks/
            └── useSocket.js    # Unified Socket.IO subscriber handlers
```

---

## 🎛️ The 15 Features (Across 4 Tiers)

AegisMesh is structured across 4 distinct operational tiers containing 15 distinct enterprise features:

### 🌐 Tier 1: Core Mesh Networking & Dijkstra Routing

#### 1. Dynamic Dijkstra Multi-hop Routing & Path Highlighting
- **Description:** Computes the shortest transmission pathway from the central Gateway controller to any node in the grid using a custom JS implementation of Dijkstra's algorithm.
- **Visuals:** Cytoscape.js highlights active routes with glowing cyan directional edges and arrows.

#### 2. Millisecond Self-Healing Failover Engine
- **Description:** Monitors live heartbeats. Upon detecting a node outage, the failover manager disables edges associated with that node and instantly recalculates alternative routing loops.
- **Trigger:** Handled automatically in the background or triggered manually via simulation hooks.

#### 3. Interactive Visual Network Topology
- **Description:** An interactive topological graph using Cytoscape.js representing the mesh system in real time.
- **Node Statuses:** 
  - 🔵 **Blue** (Gateway)
  - 🟢 **Green** (Healthy)
  - 🟡 **Yellow** (Unstable Link)
  - 🔴 **Red** (Failed Node)
- **Features:** Supports zooming, panning, dragging nodes, and clicking a node to slide out a complete inspector panel containing full metadata.

#### 4. Interactive Monospace CLI Web Terminal
- **Description:** An SSH-like virtual console allowing operators to execute diagnostic operations. Supports tab-autocompletion and command history navigation (Up/Down arrow keys).
- **Core Commands:**
  - `ping <nodeId>`: Evaluates target latency and health.
  - `traceroute <nodeId>`: Lists hop-by-hop Dijkstra paths.
  - `status`: Renders formatted ASCII status tables with health bars.
  - `predict`: Analyzes time-to-failure forecasts.
  - `netstat`: Exposes active sockets, broker configuration, and throughput.
  - `topology`: Draws a live ASCII layout of the active mesh.
  - `fail <nodeId>` / `heal <nodeId>`: Manually simulates node failures or recoveries.

---

### 🧠 Tier 2: AI & Operational Intelligence

#### 5. AI Predictive Failure Forecast Engine
- **Description:** A rolling buffer service monitoring telemetry parameters (CPU load, heat, packet loss, gas). Smooths trends using Exponentially Weighted Moving Averages (EWMA, $\alpha = 0.3$) and computes anomaly Z-scores. Performs linear regression to predict the precise timestamp a node's metrics will cross critical danger levels.
- **Alerts:** Emits warning signals when predictive risk scores exceed 70%.

#### 6. Event-Driven Autonomous Remediations (Playbooks)
- **Description:** A declarative rule engine automating system responses to alerts.
- **Included Rules:**
  - *Auto-Eco Mode:* Shifts node to ECO mode if battery falls below 30%.
  - *Thermal Shutdown:* Puts node to SLEEP if temperature exceeds 50°C.
  - *Crash Recovery:* Performs an OTA reboot if CPU usage remains above 90% for consecutive cycles.

#### 7. Real-Time SLA Compliance Monitor & Breach Log
- **Description:** Continuously tracks compliance with service-level agreements.
- **Monitored SLA Targets:**
  - Network Availability > 99%
  - Average Latency < 150ms
  - Packet Loss < 5%
- **Outputs:** Evaluates compliance percentages, logs active breaches, and flags alerts on the dashboard.

#### 8. Historical Analytics Performance Engine
- **Description:** Renders historical graphs using Recharts representing network variables.
- **Views:**
  - Area charts tracking overall network health metrics.
  - Multi-line comparative charts plotting telemetry data across custom node groupings.
  - Distribution graphs tracking failover durations and frequency histograms.

---

### 🔋 Tier 3: Advanced IoT Simulation & Utilities

#### 9. Smart Power Grid Simulator
- **Description:** Models energy usage for each IoT device based on CPU load, wireless transmission, packet frequencies, and current operational states.
- **Power Modes:** `NORMAL` (1.0x drain), `ECO` (0.5x drain), `SLEEP` (0.1x drain), and `DEAD` (fails node when battery hits 0%).
- **Solar Harvesting:** Simulates random daytime solar bursts that recharge battery cells.

#### 10. Logic Zones Map with Geofenced Drag-and-Drop Tracking
- **Description:** A physical floor plan split into logical geofenced sectors: Server Room, Corridor, Lab, and Loading Bay.
- **Actions:** Drag nodes across zone borders. The system detects transitions, triggers movement notifications, and updates zone-specific rules.

#### 11. Circular Snapshot Buffer Replay (Network DVR)
- **Description:** Records network state snapshots in a circular buffer.
- **Controls:** Allows operators to pause the live dashboard feed, scrub back in time using a slider, and replay historical network snapshots at speed multipliers ranging from 0.5x to 4x.

#### 12. Multi-Mesh Domain Switcher
- **Description:** Allows toggling between separate, independent logical meshes.
- **Meshes:**
  - `mesh-hq`: Gateway 1 routing Node Alpha, Beta, Gamma, Delta (Building A).
  - `mesh-warehouse`: Gateway 2 routing Node Echo, Foxtrot, Golf, Hotel (Building B).
- **Controls:** Controlled via the custom dropdown switcher located in the navigation header bar.

---

### 🔌 Tier 4: Enterprise Integration & Architecture

#### 13. Interactive OpenAPI & Swagger Documentation
- **Description:** Fully documents the REST API surface area.
- **Path:** Serves a Swagger-UI instance at `/api-docs` using `swagger-jsdoc` middleware configurations.

#### 14. Telegram & Discord Alert Bot Dispatcher
- **Description:** Broadcasts critical alerts to Telegram channels and Discord channels.
- **Resilience:** Implements automatic mock fallback logs if API keys are omitted, ensuring smooth local development.

#### 15. Offline Progressive Web App (PWA) Support
- **Description:** Implements offline caching of HTML, CSS, JS, and font resources via a custom service worker (`sw.js`). Includes an offline manifest (`manifest.json`) supporting standalone app installation.

---

## 🔧 Simulation Scenarios

| Option | Event Flow |
|---|---|
| **Disconnect Node** | Simulates hardware loss. Recalculates Dijkstra routes, alerts dispatchers, and logs event metrics. |
| **Recover Node** | Restores node. Re-establishes links, restores previous routes, and logs recovery status. |
| **Inject Packet Loss** | Induces 15%–35% link degradation. Flags node as `unstable`, triggers alerts, and logs SLA warnings. |
| **High Latency Spike** | Injects 200ms–500ms transit delays. Tests Dijkstra's path-weighting logic. |
| **Rogue Spoofing** | Simulates node cloning. Triggers playbook remediation to quarantine the rogue node. |
| **DVR Playback** | Pauses live ticks, allowing manual time-scrubbing. |

---

## 💻 Tech Stack

- **Frontend:** React 18, Zustand, Recharts, Cytoscape.js, Lucide Icons, Framer Motion
- **Styling:** Vanilla CSS + Tailwind CSS v4, custom glassmorphism components
- **Backend:** Node.js, Express, Socket.IO, Aedes MQTT Broker, Swagger-JSDoc
- **Offline:** Service Workers, Web App Manifest (PWA)

---

## 📡 REST API Directory

| Method | Endpoint | Description |
|:---|:---|:---|
| **GET** | `/api/health` | Diagnostic status check |
| **GET** | `/api/topology` | Current active mesh graph data |
| **GET** | `/api/nodes` | Metadata details for all registered nodes |
| **GET** | `/api/routes` | All active shortest-path Dijkstra maps |
| **GET** | `/api/events` | Recent event logs |
| **GET** | `/api/alerts` | Active network alerts |
| **GET** | `/api/predictions` | AI failure forecast overview |
| **GET** | `/api/analytics/report` | Pre-compiled PDF network health metrics |
| **GET** | `/api/power` | Power grid metrics |
| **GET** | `/api/playbooks` | Active playbooks list |
| **GET** | `/api/zones` | Logical geofenced zone configuration |
| **GET** | `/api/replay/history` | Frame list for DVR playback |
| **GET** | `/api/sla/targets` | Defined SLA latency/uptime targets |
| **GET** | `/api/capacity/report` | Expansion growth report |

---

## 🔌 Socket.IO Event Map

### Incoming Events (Client → Server)
- `mesh:switch`: Switch active mesh database domain (`{ meshId: 'mesh-hq' }`).
- `command:execute`: Run CLI string commands.
- `ota:start` / `ota:cancel` / `ota:rollback`: OTA firmware actions.
- `power:set-mode`: Update node power state (`NORMAL`, `ECO`, `SLEEP`).
- `replay:start` / `replay:pause` / `replay:stop` / `replay:scrub`: DVR controls.
- `zone:move-node`: Update spatial zone coordinates.

### Outgoing Events (Server → Client)
- `topology:update`: Pushes updated node/link structures.
- `prediction:warning`: Dispatches critical AI forecast warnings.
- `power:critical` / `power:dead`: Triggered during power events.
- `playbook:triggered`: Logs automated recovery playbooks.
- `replay:frame`: Broadcasts topology frames during DVR playback.
