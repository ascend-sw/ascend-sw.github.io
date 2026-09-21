# @sitespeed.io/log

A small, zero-dependency console logger used by
[sitespeed.io](https://www.sitespeed.io/) and related projects. It writes
timestamped, level-aware messages to `console`, supports printf-style
placeholders, and is configured once for the whole process.

## Install

```bash
npm install @sitespeed.io/log
```

Requires Node.js 22 or later. ESM only.

## Usage

```js
import { configureLog, getLogger } from '@sitespeed.io/log';

configureLog({ verbose: 1 });

const log = getLogger('my-module');

log.info('Starting up');
log.debug('Using config %j', { port: 3000 });
log.error('Failed to load %s', 'plugin.js', new Error('boom'));
```

Output:

```
[2025-05-16 14:22:01] INFO: Starting up
[2025-05-16 14:22:01] DEBUG: [my-module] Using config {
  "port": 3000
}
[2025-05-16 14:22:01] ERROR: [my-module] Failed to load plugin.js Error: boom
    at ...
```

At `info` (the default) the logger name is omitted. At `debug` and below
it is included, since extra noise is usually wanted there.

## Log levels

Lowest number = most critical. Setting a level enables that level and
everything more critical:

| Level    | Number | `console` method |
|----------|-------:|------------------|
| none     |      0 | (disabled)       |
| critical |      1 | `error`          |
| error    |      2 | `error`          |
| warning  |      3 | `warn`           |
| info     |      4 | `info` (default) |
| debug    |      5 | `debug`          |
| verbose  |      6 | `log`            |
| trace    |      7 | `trace`          |

## Configuration

```js
configureLog({
  level: 'debug',  // exact level by name (takes precedence)
  verbose: 0,      // 0 = info, 1 = debug, 2 = verbose, 3 = trace
  silent: false    // true disables all logging
});
```

Precedence: `silent` > `level` > `verbose`. Call `configureLog()` once
near the start of your process; configuration is global.

## Logger API

`getLogger(name)` returns a `Logger`. Names show up in the output when
the level is `debug` or below.

```js
const log = getLogger('my-module');

log.critical(message, ...args);
log.error(message, ...args);
log.warning(message, ...args);   // log.warn is an alias
log.info(message, ...args);
log.debug(message, ...args);
log.verbose(message, ...args);
log.trace(message, ...args);

if (log.isEnabledFor('debug')) {
  log.debug('Expensive: %j', computeStuff());
}
```

## Message placeholders

Placeholders are replaced left-to-right with the trailing arguments.
Leftover arguments are appended.

| Placeholder | Replaced with                                          |
|-------------|--------------------------------------------------------|
| `%s`        | `String(arg)`                                          |
| `%d`        | `String(Number(arg))`                                  |
| `%j`        | `JSON.stringify(arg, null, 2)`                         |
| `%O`        | Pretty-printed object, or `{name, message, stack}` for `Error` |
| `%?`        | Inline: `String(arg)`, pretty JSON for objects, `Error: …\n<stack>` for `Error` |

```js
log.info('user=%s requests=%d', 'alice', 42);
log.error('Request failed: %?', err);
```

`$` is not a special character — `log.info('price $1')` prints `price $1`
verbatim.

## Advanced

`Logger` and the live `loggerConfig` object are exported for cases where
you need to subclass or read the current level/format directly. Most
users only need `configureLog` and `getLogger`.

## License

Apache-2.0
