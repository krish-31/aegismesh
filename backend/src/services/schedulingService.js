/**
 * SchedulingService — Implements the 0/1 Knapsack Dynamic Programming algorithm.
 * Used to optimize task allocation on resource-constrained edge nodes.
 */

class SchedulingService {
  constructor() {
    this.io = null;
    // Default task pool for simulation
    this.mockTasks = [
      { id: 't1', name: 'ML Inference', weight: 30, value: 80 },
      { id: 't2', name: 'Sensor Encryption', weight: 20, value: 50 },
      { id: 't3', name: 'Video Compression', weight: 40, value: 90 },
      { id: 't4', name: 'Thermal Anomaly Check', weight: 15, value: 60 },
      { id: 't5', name: 'OTA Boot Signature', weight: 25, value: 40 },
    ];
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  getMockTasks() {
    return this.mockTasks;
  }

  /**
   * Solves the 0/1 Knapsack Problem using Dynamic Programming
   * @param {Array} tasks - Array of { id, name, weight, value }
   * @param {number} capacity - Maximum weight capacity (CPU %)
   * @returns {Object} - Optimal solution containing matrix table, selected tasks, and total value
   */
  solveKnapsack(tasks = this.mockTasks, capacity = 80) {
    const n = tasks.length;
    // Initialize DP matrix with 0s
    // Row 0 is base case (no tasks), Col 0 is base case (0 capacity)
    const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));

    // Fill the DP table
    for (let i = 1; i <= n; i++) {
      const task = tasks[i - 1];
      for (let w = 0; w <= capacity; w++) {
        if (task.weight <= w) {
          dp[i][w] = Math.max(
            dp[i - 1][w],
            dp[i - 1][w - task.weight] + task.value
          );
        } else {
          dp[i][w] = dp[i - 1][w];
        }
      }
    }

    // Backtrack to identify selected items
    const selectedTasks = [];
    let w = capacity;
    for (let i = n; i > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        selectedTasks.push(tasks[i - 1]);
        w -= tasks[i - 1].weight;
      }
    }

    return {
      optimalValue: dp[n][capacity],
      selectedTasks: selectedTasks.reverse(),
      dpTable: dp, // Return full table for visual step render
      capacity,
      tasks
    };
  }
}

module.exports = new SchedulingService();
