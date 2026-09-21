import { loggerConfig } from './config.js';
import { LOG_LEVELS } from './logLevels.js';

/**
 * Configures the global logger settings.
 * @param {Object} options - Configuration options.
 * @param {string} [options.level] - Directly set a log level by name (e.g., 'error', 'panic', 'info').
 * @param {number} [options.verbose=0] - Verbosity level (0: INFO, 1: DEBUG, 2: VERBOSE, 3: TRACE).
 * @param {boolean} [options.silent=false] - If true, disables all logging.
 */
export function configureLog(options = {}) {
  const { level: customLevel, verbose = 0, silent = false } = options;

  let finalLevel;

  if (silent) {
    finalLevel = 'none';
  } else if (customLevel && LOG_LEVELS[customLevel] !== undefined) {
    finalLevel = customLevel;
  } else {
    switch (verbose) {
      case 1: {
        finalLevel = 'debug';
        break;
      }
      case 2: {
        finalLevel = 'verbose';
        break;
      }
      case 3: {
        finalLevel = 'trace';
        break;
      }
      default: {
        finalLevel = 'info';
        break;
      }
    }
  }

  loggerConfig.level = finalLevel;

  // Adjust the format depending on how detailed logs are
  const numericLevel = LOG_LEVELS[finalLevel];
  loggerConfig.format =
    numericLevel <= LOG_LEVELS.info
      ? '[%(date)s] %(levelname)s: %(message)s'
      : '[%(date)s] %(levelname)s: [%(name)s] %(message)s';
}

const CONSOLE_METHOD_MAP = {
  none: 'log',
  critical: 'error',
  error: 'error',
  warning: 'warn',
  info: 'info',
  debug: 'debug',
  verbose: 'log',
  trace: 'trace'
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatPlaceholders(message, args) {
  // it's not a string
  if (!message.replaceAll) {
    return message;
  }

  let formatted = message;
  let argIndex = 0;

  // Regular expression to find all placeholders
  const placeholderRegex = /%[sdjO?]/g;
  formatted = formatted.replaceAll(placeholderRegex, match => {
    if (argIndex >= args.length) {
      // No corresponding argument left
      return match;
    }
    const arg = args[argIndex++];
    switch (match) {
      case '%s': {
        return String(arg);
      }
      case '%d': {
        return String(Number(arg));
      }
      case '%j': {
        try {
          return JSON.stringify(arg, undefined, 2);
        } catch {
          return '[Circular JSON]';
        }
      }
      case '%O': {
        if (arg instanceof Error) {
          const errorObj = {
            name: arg.name,
            message: arg.message,
            stack: arg.stack
          };
          return JSON.stringify(errorObj, undefined, 2);
        }
        try {
          return JSON.stringify(arg, undefined, 2);
        } catch {
          return '[Circular JSON]';
        }
      }
      case '%?': {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\n${arg.stack}`;
        } else if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, undefined, 2);
          } catch {
            return '[Circular JSON]';
          }
        } else {
          return String(arg);
        }
      }
      default: {
        return match;
      }
    }
  });

  if (argIndex < args.length) {
    const leftover = args.slice(argIndex);
    for (const leftoverArg of leftover) {
      if (leftoverArg instanceof Error) {
        formatted += ` Error: ${leftoverArg.message}\n${leftoverArg.stack}`;
      } else if (typeof leftoverArg === 'object') {
        try {
          formatted += ` ${JSON.stringify(leftoverArg, undefined, 2)}`;
        } catch {
          formatted += ' [Circular JSON]';
        }
      } else {
        formatted += ` ${String(leftoverArg)}`;
      }
    }
  }

  return formatted;
}

export class Logger {
  constructor(name = '') {
    this.name = name;
  }

  isEnabledFor(levelName) {
    const currentLevel = loggerConfig.level.toLowerCase();
    return LOG_LEVELS[levelName] <= LOG_LEVELS[currentLevel];
  }

  log(level, message, ...args) {
    try {
      const currentLevel = loggerConfig.level.toLowerCase();
      if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) {
        return;
      }

      const timestamp = getTimestamp();
      const upperLevel = level.toUpperCase();

      let formattedMessage = formatPlaceholders(message, args);

      const finalOutput = loggerConfig.format
        .replace('%(date)s', () => timestamp)
        .replace('%(levelname)s', () => upperLevel)
        .replace('%(name)s', () => this.name)
        .replace('%(message)s', () => formattedMessage);

      const consoleMethod = CONSOLE_METHOD_MAP[level] ?? 'log';
      console[consoleMethod](finalOutput);
    } catch (error) {
      console.error('Could not create the log message');
      console.error(`${message} with the error ${error}`);
    }
  }

  critical(message, ...args) {
    this.log('critical', message, ...args);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warning(message, ...args) {
    this.log('warning', message, ...args);
  }

  warn(message, ...args) {
    this.log('warning', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  verbose(message, ...args) {
    this.log('verbose', message, ...args);
  }

  trace(message, ...args) {
    this.log('trace', message, ...args);
  }
}

export function getLogger(name) {
  return new Logger(name);
}
