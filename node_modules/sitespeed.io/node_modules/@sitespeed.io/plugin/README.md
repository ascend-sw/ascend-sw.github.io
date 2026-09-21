# @sitespeed.io/plugin

Base class for [sitespeed.io](https://www.sitespeed.io/) plugins. Extend it,
implement `processMessage`, and sitespeed.io will instantiate and drive your
plugin through the message queue.

See the [plugin documentation](https://www.sitespeed.io/documentation/sitespeed.io/plugins/#how-to-create-your-own-plugin)
for the full plugin lifecycle.

## Install

```bash
npm install @sitespeed.io/plugin
```

## Usage

```js
import { SitespeedioPlugin } from '@sitespeed.io/plugin';

export default class MyPlugin extends SitespeedioPlugin {
  constructor(options, context, queue) {
    super({ name: 'myplugin', options, context, queue });
  }

  async open() {
    // optional: setup on startup
  }

  async processMessage(message) {
    if (message.type === 'url') {
      this.log.info('Got a URL: %s', message.url);
      await this.sendMessage('myplugin.data', { hello: 'world' });
    }
  }

  async close() {
    // optional: cleanup on shutdown
  }
}
```

## API

- `this.name` / `getName()` — plugin name
- `this.options` / `getOptions()` — sitespeed.io start options
- `this.context` / `getContext()` — sitespeed.io context
- `this.queue` — the message queue
- `this.log` / `getLog()` — logger (call levels directly: `this.log.info(...)`)
- `getStorageManager()` — storage manager for writing files
- `getFilterRegistry()` — filter registry for TimeSeries metrics
- `sendMessage(type, data, extras)` — post a message on the queue
- `open()` / `close()` — lifecycle hooks (override as needed)
- `processMessage(message)` — **must be implemented** by your subclass

## License

MIT
