import { EventEmitter } from 'events';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  forwardId?: string;
}

/**
 * Captures and manages logs from port-forwards
 */
export class LogCapture extends EventEmitter {
  private logs: Map<string, LogEntry[]> = new Map();
  private maxLogsPerForward: number = 1000;

  constructor(maxLogsPerForward: number = 1000) {
    super();
    this.maxLogsPerForward = maxLogsPerForward;
  }

  /**
   * Add a log entry
   */
  log(forwardId: string, level: LogEntry['level'], message: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      forwardId,
    };

    if (!this.logs.has(forwardId)) {
      this.logs.set(forwardId, []);
    }

    const forwardLogs = this.logs.get(forwardId)!;
    forwardLogs.push(entry);

    // Trim logs if exceeding max
    if (forwardLogs.length > this.maxLogsPerForward) {
      forwardLogs.shift();
    }

    this.emit('log', entry);
  }

  /**
   * Get logs for a specific forward
   */
  getLogs(forwardId: string): LogEntry[] {
    return this.logs.get(forwardId) || [];
  }

  /**
   * Get all logs
   */
  getAllLogs(): LogEntry[] {
    const allLogs: LogEntry[] = [];

    for (const logs of this.logs.values()) {
      allLogs.push(...logs);
    }

    return allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear logs for a specific forward
   */
  clearLogs(forwardId: string): void {
    this.logs.delete(forwardId);
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    this.logs.clear();
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogEntry['level'], forwardId?: string): LogEntry[] {
    if (forwardId) {
      const logs = this.logs.get(forwardId) || [];
      return logs.filter((log) => log.level === level);
    }

    return this.getAllLogs().filter((log) => log.level === level);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number, forwardId?: string): LogEntry[] {
    if (forwardId) {
      const logs = this.logs.get(forwardId) || [];
      return logs.slice(-count);
    }

    const allLogs = this.getAllLogs();
    return allLogs.slice(-count);
  }

  /**
   * Search logs by message content
   */
  searchLogs(query: string, forwardId?: string): LogEntry[] {
    const searchIn = forwardId ? this.logs.get(forwardId) || [] : this.getAllLogs();

    const lowerQuery = query.toLowerCase();
    return searchIn.filter((log) => log.message.toLowerCase().includes(lowerQuery));
  }

  /**
   * Export logs as JSON
   */
  exportLogs(forwardId?: string): string {
    const logs = forwardId ? this.getLogs(forwardId) : this.getAllLogs();
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Get log count
   */
  getLogCount(forwardId?: string): number {
    if (forwardId) {
      return this.logs.get(forwardId)?.length || 0;
    }

    let count = 0;
    for (const logs of this.logs.values()) {
      count += logs.length;
    }
    return count;
  }

  /**
   * Get error count
   */
  getErrorCount(forwardId?: string): number {
    return this.getLogsByLevel('error', forwardId).length;
  }

  /**
   * Get warning count
   */
  getWarningCount(forwardId?: string): number {
    return this.getLogsByLevel('warn', forwardId).length;
  }
}
