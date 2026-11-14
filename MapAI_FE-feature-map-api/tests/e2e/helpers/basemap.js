import fs from 'node:fs';
import { PMTiles, FileSource } from 'pmtiles';
const offlineRoot = new URL('../../../public/offline/', import.meta.url);
const archive = new PMTiles(new FileSource(new File([fs.readFileSync(new URL('danang.pmtiles', offlineRoot))], 'fixture.pmtiles')));
// Isolate UI tests from external services using the real downloaded OpenFreeMap extract.
export const rasterTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAADIElEQVR4nO3UIQEAIBDAwO8fD4ujCMRA7MT5qc3a5wJN8zsA+McAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIOwB5481U62AaXAAAAAASUVORK5CYII=', 'base64');
export async function mockStreetTiles(page) {
  const image = route => route.fulfill({ body: rasterTile, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
  await page.route('https://tile.openstreetmap.org/**', image);
  await page.route('https://a.tile.openstreetmap.fr/**', image);
  await page.route('https://tiles.openfreemap.org/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const headers = { 'access-control-allow-origin': '*' };
    if (pathname === '/planet' || pathname === '/planet/latest') return route.fulfill({ headers, json: {
      tilejson: '3.0.0', minzoom: 0, maxzoom: 14, tiles: ['https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf'],
      attribution: 'OpenFreeMap | OpenMapTiles | OpenStreetMap contributors',
    } });
    const tile = pathname.match(/\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
    if (tile) {
      const result = await archive.getZxy(...tile.slice(1).map(Number));
      return route.fulfill({ headers, body: result ? Buffer.from(result.data) : Buffer.alloc(0), contentType: 'application/x-protobuf' });
    }
    let file = pathname.startsWith('/fonts/') ? `map${pathname}` : pathname.startsWith('/sprites/') ? `map/sprite${pathname.slice(pathname.lastIndexOf('/ofm') + 4)}` : pathname.startsWith('/natural_earth/ne2sr/') ? `map/earth/${pathname.slice(22)}` : 'map/style.json';
    if (pathname.startsWith('/natural_earth/')) file = `map/earth/${pathname.split('/').slice(3).join('/')}`;
    const contentType = file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'application/x-protobuf';
    try { return await route.fulfill({ headers, body: fs.readFileSync(new URL(file, offlineRoot)), contentType }); }
    catch { return route.fulfill({ headers, status: 404 }); }
  });
}
