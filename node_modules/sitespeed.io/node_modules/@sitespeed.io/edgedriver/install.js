import os from 'node:os';
import path from 'node:path';
import { mkdir, unlink, chmod } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import StreamZip from 'node-stream-zip';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The version of the driver that will be installed
const EDGEDRIVER_VERSION =
  process.env.EDGEDRIVER_VERSION || pkg.edgedriver_version;

function byteHelper(value) {
  // https://gist.github.com/thomseddon/3511330
  if (!value) return '?';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(value) / Math.log(1024));
  return `${(value / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getDriverArchiveName() {
  const platform = os.platform();
  const arch = os.arch();
  if (platform === 'darwin') {
    return arch === 'arm64'
      ? 'edgedriver_mac64_m1.zip'
      : 'edgedriver_mac64.zip';
  }
  if (platform === 'linux') {
    return 'edgedriver_linux64.zip';
  }
  if (platform === 'win32') {
    if (arch === 'x64') return 'edgedriver_win64.zip';
    if (arch === 'ia32') return 'edgedriver_win32.zip';
  }
  return;
}

function getDriverUrl(archive) {
  const base =
    process.env.EDGEDRIVER_BASE_URL ||
    `https://msedgedriver.microsoft.com/${EDGEDRIVER_VERSION}/`;
  return `${base}${archive}`;
}

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}`
    );
  }
  const total = Number(response.headers.get('content-length')) || 0;
  let downloaded = 0;
  let lastLog = 0;
  const body = Readable.fromWeb(response.body);
  body.on('data', chunk => {
    downloaded += chunk.length;
    const now = Date.now();
    if (now - lastLog >= 250) {
      const pct = total ? ((downloaded / total) * 100).toFixed(1) : '?';
      console.log(`${pct}% [${byteHelper(downloaded)}/${byteHelper(total)}]`);
      lastLog = now;
    }
  });
  await pipeline(body, createWriteStream(destination));
}

async function extractArchive(zipPath, destDir) {
  const zip = new StreamZip.async({ file: zipPath });
  try {
    await zip.extract(undefined, destDir);
  } finally {
    await zip.close();
  }
}

async function tryUnlink(p) {
  try {
    await unlink(p);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function install() {
  if (
    process.env.npm_config_edgedriver_skip_download ||
    process.env.EDGEDRIVER_SKIP_DOWNLOAD
  ) {
    console.log('Skip downloading Edgedriver');
    return;
  }

  const archive = getDriverArchiveName();
  if (!archive) {
    console.log(
      `Skipping installing Edgedriver on ${os.platform()} for ${os.arch()} since there's no official build`
    );
    return;
  }

  const url = getDriverUrl(archive);
  const vendorDir = path.resolve(__dirname, 'vendor');
  await mkdir(vendorDir, { recursive: true });

  const zipPath = path.join(vendorDir, 'msedgedriver.zip');
  const ext = os.platform() === 'win32' ? '.exe' : '';
  const binPath = path.join(vendorDir, `msedgedriver${ext}`);

  await tryUnlink(binPath);

  console.log(`Downloading Edgedriver ${EDGEDRIVER_VERSION} from ${url}`);
  await downloadFile(url, zipPath);
  await extractArchive(zipPath, vendorDir);
  await tryUnlink(zipPath);
  await tryUnlink(path.join(vendorDir, 'Driver_Notes', 'credits.html'));
  await chmod(binPath, 0o755);
  console.log(`Edgedriver ${EDGEDRIVER_VERSION} installed in ${vendorDir}`);
}

try {
  await install();
} catch (error) {
  console.error(
    `Edgedriver ${EDGEDRIVER_VERSION} could not be installed: ${error.message}`
  );
  process.exitCode = 1;
}
