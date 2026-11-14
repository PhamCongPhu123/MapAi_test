import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function files(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => ['node_modules', 'bin', 'obj', 'Migrations'].includes(entry.name) ? [] :
    entry.isDirectory() ? files(path.join(dir, entry.name), extension) : entry.name.endsWith(extension) ? [path.join(dir, entry.name)] : []);
}
test('offline business layer has no React, persistence, platform or transport dependencies', () => {
  for (const p of ['src/offline/application', 'src/map/application'].flatMap(dir => files(path.join(root, dir), '.js'))) {
    const s = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(s, /from\s+['"][^'"]*(?:infrastructure|presentation|compositionRoot|react|dexie|capacitor)/, p);
    assert.doesNotMatch(s, /\b(?:indexedDB|localStorage|navigator|window|fetch)\s*[.(]/, p);
  }
});
test('offline presentation uses business/composition APIs rather than direct database adapters', () => {
  for (const dir of ['src/features/offline', 'src/offline/presentation']) for (const p of files(path.join(root, dir), '.js').concat(files(path.join(root, dir), '.jsx'))) {
    assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /from\s+['"][^'"]*(?:infrastructure|dexie|\/db)['"/]/, p);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/pages/OfflineMapPage.jsx'), 'utf8'), /(?:indexedDB|navigator\.geolocation|new Worker|infrastructure\/)/);
});
test('backend business core does not reference Infrastructure or Entity Framework', () => {
  const base = path.join(root, '../MapAI_BE-main/src');
  for (const project of ['MapAI.Application', 'MapAI.Domain']) {
    const p = path.join(base, project, project + '.csproj');
    assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /MapAI\.Infrastructure|Microsoft\.EntityFrameworkCore|Npgsql|Google\.Apis|MailKit|MimeKit|ImageSharp/);
    for (const f of files(path.join(base, project), '.cs')) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /using (?:MapAI\.Infrastructure|Microsoft\.EntityFrameworkCore|Npgsql|Google\.Apis)|\bMapAIContext\b/, f);
  }
  for (const p of files(path.join(base, 'MapAI.API/Controllers'), '.cs')) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /using (?:Microsoft\.EntityFrameworkCore|Npgsql|MapAI\.Infrastructure)|\bMapAIContext\b/, p);
  assert.ok(fs.existsSync(path.join(base, 'MapAI.Infrastructure/Persistence/MapAIContext.cs')));
});
