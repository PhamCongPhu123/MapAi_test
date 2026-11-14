// Isolate UI tests from external tile servers. This neutral tile is not live map data.
export const rasterTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAADIElEQVR4nO3UIQEAIBDAwO8fD4ujCMRA7MT5qc3a5wJN8zsA+McAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIMwAIOwB5481U62AaXAAAAAASUVORK5CYII=', 'base64');
export async function mockStreetTiles(page) {
  const image = route => route.fulfill({ body: rasterTile, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
  await page.route('https://tile.openstreetmap.org/**', image);
  await page.route('https://a.tile.openstreetmap.fr/**', image);
  await page.route('https://tiles.openfreemap.org/**', route => {
    if (new URL(route.request().url()).pathname !== '/styles/liberty') return image(route);
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: {
      version: 8,
      sources: { 'fixture-openfreemap': { type: 'raster', tileSize: 256,
        tiles: ['https://tiles.openfreemap.org/test-fixture/{z}/{x}/{y}.png'],
        attribution: 'OpenFreeMap | OpenStreetMap contributors' } },
      layers: [{ id: 'fixture-base', type: 'raster', source: 'fixture-openfreemap' }],
    } });
  });
}
