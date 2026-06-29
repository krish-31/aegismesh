/**
 * EdgeComputingService — Simulates task offloading and execution at the mesh edge
 */

const topology = require('./topologyService');
const mockData = require('./mockDataService');

class EdgeComputingService {
  constructor() {
    this.io = null;
    this.tasks = [];
    this.taskCounter = 1;
    this.isActive = false;
    this.intervalId = null;
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    console.log('[Edge Compute] ✓ Simulation engine starting...');
    this.intervalId = setInterval(() => this.tick(), 2000);
  }

  stop() {
    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getTasks() {
    return this.tasks;
  }

  generateTask(originNodeId, taskType) {
    const types = ['ML Inference', 'Sensor Cryptography', 'Anomaly Scanning', 'Climate Data Compression'];
    const type = taskType || types[Math.floor(Math.random() * types.length)];
    const complexity = Math.floor(Math.random() * 40) + 30; // CPU capacity required

    const task = {
      id: `task-${this.taskCounter++}`,
      name: type,
      complexity,
      origin: originNodeId,
      executor: originNodeId,
      status: 'pending', // pending, executing, completed, offloaded
      progress: 0,
      timestamp: new Date().toISOString(),
      hops: 0,
      path: []
    };

    this.tasks.push(task);
    console.log(`[Edge Compute] ✓ Created task [${task.id} - ${task.name}] complexity:${complexity}% on node ${originNodeId}`);
    
    const node = topology.getNode(originNodeId);
    if (node) {
      // Check if node is overloaded
      const currentCpu = node.cpuUsage || 20;
      if (currentCpu > 75) {
        this.offloadTask(task.id, originNodeId);
      } else {
        task.status = 'executing';
        this.emit('edge:task:new', task);
      }
    }
    
    // Broadcast tasks update immediately to all connected clients
    this.emit('edge:tasks:update', this.tasks);
    return task;
  }

  offloadTask(taskId, fromNodeId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Find nearest neighbor that has low CPU usage
    const allNodes = topology.getAllNodes().filter(n => n.nodeId !== fromNodeId && n.status === 'healthy' && !n.isGateway);
    if (allNodes.length === 0) {
      // Nowhere to offload, execute locally but slowly
      task.status = 'executing';
      task.message = 'No idle neighbors; forced local overload execution';
      this.emit('edge:tasks:update', this.tasks);
      return;
    }

    // Find node with lowest CPU
    allNodes.sort((a, b) => (a.cpuUsage || 0) - (b.cpuUsage || 0));
    const targetNode = allNodes[0];

    // Compute route path
    const route = topology.getShortestPath(fromNodeId, targetNode.nodeId);
    task.executor = targetNode.nodeId;
    task.status = 'offloaded';
    task.hops = route.path.length - 1;
    task.path = route.path;
    task.message = `Offloaded from ${fromNodeId} to ${targetNode.nodeId} via ${task.hops} hops`;

    console.log(`[Edge Compute] 🧠 Offloading task [${task.id}] from overloaded node ${fromNodeId} ➔ ${targetNode.nodeId} (${task.hops} hops)`);

    this.emit('edge:task:offload', {
      taskId: task.id,
      from: fromNodeId,
      to: targetNode.nodeId,
      path: route.path
    });

    const evt = mockData.pushEvent({
      type: 'EDGE_TASK_OFFLOAD',
      severity: 'WARNING',
      message: `🧠 Task [${task.id}] offloaded from overloaded node ${fromNodeId} ➔ ${targetNode.nodeId} (${task.hops} hops)`,
      nodeId: fromNodeId
    });
    this.emit('event:new', evt);

    // Broadcast tasks update immediately to all connected clients
    this.emit('edge:tasks:update', this.tasks);
  }

  tick() {
    if (!this.isActive) return;
    console.log('[Edge Compute] tick - active tasks:', this.tasks.length);

    // Progress active tasks
    this.tasks.forEach(task => {
      if (task.status === 'executing' || task.status === 'offloaded') {
        const increment = Math.floor(Math.random() * 20) + 15;
        task.progress = Math.min(100, task.progress + increment);

        if (task.progress >= 100) {
          task.status = 'completed';
          
          this.emit('edge:task:complete', { taskId: task.id, executor: task.executor });
          
          // Complete telemetry logs
          const evt = mockData.pushEvent({
            type: 'EDGE_TASK_COMPLETED',
            severity: 'INFO',
            message: `✓ Edge Task [${task.id} - ${task.name}] execution completed on node ${task.executor}`,
            nodeId: task.executor
          });
          this.emit('event:new', evt);
        }
      }
    });

    // Remove completed tasks older than 10 seconds
    const now = Date.now();
    this.tasks = this.tasks.filter(task => {
      if (task.status === 'completed') {
        const taskTime = new Date(task.timestamp).getTime();
        return now - taskTime < 10000;
      }
      return true;
    });

    // Auto generate mock tasks dynamically
    const healthyNodes = topology.getAllNodes().filter(n => n.status === 'healthy' && !n.isGateway);
    if (healthyNodes.length > 0 && Math.random() < 0.4) {
      const randomNode = healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
      this.generateTask(randomNode.nodeId);
    }

    this.emit('edge:tasks:update', this.tasks);
  }
}

module.exports = new EdgeComputingService();
