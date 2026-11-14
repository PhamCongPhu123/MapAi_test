import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { validateMobileApiUrl } from './mobile-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [target, platform = 'android'] = process.argv.slice(2);
if (!['development', 'production', 'offline'].includes(target) || !['android', 'ios'].includes(platform)) {
  console.error('Cách dùng: node scripts/mobile.mjs development|production|offline [android|ios]');
  process.exit(1);
}

const development = target === 'development';
const offline = target === 'offline';
const mode = development ? 'mobile-development' : 'mobile';
const env = { ...process.env, ...loadEnv(mode, root, 'VITE_') };
try {
  env.VITE_API_BASE_URL = offline ? '' : validateMobileApiUrl(env.VITE_API_BASE_URL, { development, platform });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

env.CAPACITOR_DEV = String(development);
// Keep the web fallback and Google web SDK out of native builds.
env.VITE_BUILD_TARGET = 'mobile';
env.VITE_START_OFFLINE = String(offline);
// Offline demo intentionally contains no backend URL and opens the bundled city package.
console.log(`Build ${platform} (${target})`);
for (const args of [
  ['node_modules/vite/bin/vite.js', 'build', '--mode', mode, '--outDir', 'dist-native'],
  ['node_modules/@capacitor/cli/bin/capacitor', 'sync', platform],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
