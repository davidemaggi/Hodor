export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Simple logger utility
 */
export class Logger {
  private context: string;
  private level: LogLevel;

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[${this.context}] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[${this.context}] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[${this.context}] ${message}`, error, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}
