import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const version = pkg.version;

export function binPath() {
  let driverPath = path.resolve(__dirname, 'vendor', 'msedgedriver');
  if (os.platform() === 'win32') {
    driverPath = driverPath + '.exe';
  }
  return driverPath;
}

export default { version, binPath };
