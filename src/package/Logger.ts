export enum LogLevel {
  SILENT = -1,
  ALWAYS = 0,
  VVVVV = 5,
  VVVV = 4,
  VVV = 3,
  VV = 2,
  V = 1,
}

class Logger {
  private level: LogLevel;
  private static logger: Logger;

  private constructor() {
    this.level = Number(process.env.LOG_LEVEL);
  }

  public static get(): Logger {
    if (!Logger.logger) Logger.logger = new Logger();
    return Logger.logger;
  }

  public log(message: any, defaultLevel: LogLevel = LogLevel.V) {
    if (this.level !== LogLevel.SILENT && this.level >= defaultLevel)
      console.log(
        `[${new Date(Date.now()).toUTCString()}] ${
          typeof message === 'string' ? message : JSON.stringify(message)
        }`
      );
  }
}

export default Logger;
