import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PMTiles, FileSource } from 'pmtiles';
import { RoutingEngine } from '../../src/offline/application/routingEngine.js';
import { createSearchEngine, normalize, distanceMeters, inBounds } from '../../src/offline/application/searchEngine.js';
import { askLocalAssistant, AREA_CHOICES } from '../../src/offline/application/localAiAgent.js';
import { LANDMARKS } from '../../src/offline/application/constants.js';

const root = new URL('../../public/offline/', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, root)));
const places = read('places.json');
const graph = read('roads.json');
const search = createSearchEngine(places);

test('Vietnamese normalization preserves meaning without accents', () => {
  assert.equal(normalize('  MỲ Quảng — Đà Nẵng! '), 'my quang da nang');
  assert.equal(normalize('Mì Quảng'), 'mi quang');
});
test('Fuzzy local search supports accents, typos, category and district filters', () => {
  for (const query of ['mi quang', 'Mì Quảng', 'mi qunag']) {
    assert.deepEqual(new Set(search({ query, district: 'Hải Châu', category: 'food' }).map(p => p.id)), new Set(['mi-ba-mua', 'mi-ba-vi']));
  }
  assert.equal(search({ query: 'mi quang', district: 'Cẩm Lệ' }).length, 0);
  assert.equal(search({ query: 'bun bo hue' }).length, 0);
  assert.equal(search({ query: 'zzqxyz' }).length, 0);
});
test('Favorites scope, distances and geographic bounds are respected', () => {
  const origin = places.find(p => p.id === 'my-khe');
  const result = search({ ids: new Set(['my-khe']), center: origin });
  assert.equal(result.length, 1); assert.equal(result[0].distance, 0);
  assert.equal(inBounds(origin, graph.bounds), true);
  assert.equal(inBounds({ lng: NaN, lat: 16 }, graph.bounds), false);
  assert.equal(inBounds({ lng: 106, lat: 10 }, graph.bounds), false);
});
test('Assistant asks for area and retains intent through clarification', () => {
  const first = askLocalAssistant('Tìm quán ăn tối ngon', places);
  assert.deepEqual(first.choices, AREA_CHOICES); assert.equal(first.places.length, 0);
  const followup = askLocalAssistant('Quanh Cầu Rồng', places, first.context);
  assert.ok(followup.places.length > 0 && followup.places.length <= 3);
  assert.ok(followup.places.every(p => p.category === 'food' && !p.tags.includes('ca phe')));
});
test('Assistant filters café and area, and never invents outside/unknown results', () => {
  const cafes = askLocalAssistant('Cà phê gần sông Hàn', places).places;
  assert.ok(cafes.length); assert.ok(cafes.every(p => p.tags.includes('ca phe')));
  assert.equal(askLocalAssistant('Tìm quán ăn tại Huế', places).places.length, 0);
  assert.equal(askLocalAssistant('wifi internet tại Hải Châu', places).places.length, 0);
  assert.equal(askLocalAssistant('Tìm món sushi ở Hải Châu', places).places.length, 0);
  const sights = askLocalAssistant('Tham quan Hải Châu', places).places;
  assert.ok(sights.length); assert.ok(sights.every(p => p.category === 'sightseeing'));
  const fun = askLocalAssistant('Vui chơi buổi chiều ở Sơn Trà', places).places;
  assert.ok(fun.length); assert.ok(fun.every(p => p.district === 'Sơn Trà' && p.category === 'entertainment'));
});
test('Assistant uses an explicit origin for near-me requests and stays inside the city', () => {
  assert.ok(askLocalAssistant('Tìm quán ăn gần đây', places, { origin: LANDMARKS[0] }).places.length);
  assert.ok(askLocalAssistant('Tìm quán ăn gần đây', places).choices);
});

const fixture = {
  bounds: [108.19, 15.99, 108.23, 16.03],
  nodes: [[108.2, 16], [108.21, 16], [108.21, 16.01], [108.2, 16.01]],
  names: ['Một chiều', 'Đường B', 'Đường C', 'Đường D'],
  edges: [[0, 1, 0, 7], [1, 2, 1, 15], [2, 3, 2, 15], [3, 0, 3, 15]],
};
const point = ([lng, lat]) => ({ lng, lat });
test('A* respects vehicle direction while walking can traverse the same street both ways', () => {
  const engine = new RoutingEngine(fixture);
  const from = point(fixture.nodes[1]), to = point(fixture.nodes[0]);
  const foot = engine.route(from, to, 'foot'), vehicle = engine.route(from, to, 'motorbike');
  assert.equal(foot.steps.length, 1); assert.equal(foot.steps[0].name, 'Một chiều');
  assert.equal(vehicle.steps.length, 3); assert.ok(vehicle.distance > foot.distance * 2.9);
  assert.deepEqual(vehicle.coordinates, [fixture.nodes[1], fixture.nodes[2], fixture.nodes[3], fixture.nodes[0]]);
});
test('A* has the same shortest distance as an independent Floyd-Warshall reference', () => {
  const engine = new RoutingEngine(fixture);
  const expected = Array.from({ length: 4 }, () => Array(4).fill(Infinity));
  for (let i = 0; i < 4; i++) expected[i][i] = 0;
  for (const [a, b, , flags] of fixture.edges) {
    const d = distanceMeters(point(fixture.nodes[a]), point(fixture.nodes[b]));
    if (flags & 4) expected[a][b] = d;
    if (flags & 8) expected[b][a] = d;
  }
  // Floyd-Warshall is intentionally independent of the production heap/A* implementation.
  for (let k = 0; k < 4; k++) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) expected[a][b] = Math.min(expected[a][b], expected[a][k] + expected[k][b]);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    assert.ok(Math.abs(engine.route(point(fixture.nodes[a]), point(fixture.nodes[b]), 'motorbike').roadDistance - expected[a][b]) < 0.01);
  }
});
test('Routing reports unsupported areas, inaccessible snaps and disconnected roads', () => {
  const engine = new RoutingEngine(fixture);
  assert.throws(() => engine.route({ lng: 106, lat: 10 }, point(fixture.nodes[0])), /ngoài gói/);
  assert.throws(() => engine.route({ lng: 108.225, lat: 16.025 }, point(fixture.nodes[0])), /350 m/);
  const disconnected = new RoutingEngine({ ...fixture, edges: [[0, 1, 0, 15], [2, 3, 1, 15]] });
  assert.throws(() => disconnected.route(point(fixture.nodes[0]), point(fixture.nodes[3])), /chưa nối/);
});
test('Bundled graph contains valid OSM coordinates, node references and direction masks', () => {
  assert.ok(graph.nodes.length > 50000 && graph.edges.length > 50000);
  assert.ok(graph.nodes.every(n => n.length === 2 && inBounds(point(n), graph.bounds)));
  assert.ok(graph.edges.every(([a, b, name, flags]) => graph.nodes[a] && graph.nodes[b] && graph.names[name] && flags > 0 && flags <= 15));
});
test('All 224 landmark-to-place walking and motorbike routes use actual connected graph edges', () => {
  const engine = new RoutingEngine(graph);
  const edges = new Set();
  for (const [a, b] of graph.edges) { edges.add(`${a}:${b}`); edges.add(`${b}:${a}`); }
  const nodeIds = new Map(graph.nodes.map((coord, i) => [coord.join(','), i]));
  let checked = 0;
  for (const start of LANDMARKS) for (const end of places) for (const mode of ['foot', 'motorbike']) {
    const route = engine.route(start, end, mode);
    assert.ok(Number.isFinite(route.distance) && route.distance >= 0 && route.minutes > 0);
    for (let i = 1; i < route.coordinates.length; i++) assert.ok(edges.has(`${nodeIds.get(route.coordinates[i - 1].join(','))}:${nodeIds.get(route.coordinates[i].join(','))}`));
    checked++;
  }
  assert.equal(checked, 224);
});
test('Every package asset matches the published SHA-256 and size', () => {
  const manifest = read('manifest.json');
  let total = 0;
  for (const asset of manifest.assets) {
    const content = fs.readFileSync(new URL(asset.path, root));
    assert.equal(content.length, asset.bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'), asset.sha256);
    total += content.length;
  }
  assert.equal(total, manifest.bytes);
});
test('PMTiles archive can be read with real tile contents in the city', async () => {
  const reader = new PMTiles(new FileSource(new File([fs.readFileSync(new URL('danang.pmtiles', root))], 'danang.pmtiles')));
  const header = await reader.getHeader();
  assert.equal(header.specVersion, 3); assert.equal(header.tileType, 1);
  assert.equal(header.numAddressedTiles, read('manifest.json').tileCount);
  const metadata = await reader.getMetadata();
  assert.match(metadata.attribution, /OpenFreeMap/);
  assert.ok(metadata.vector_layers.some(layer => layer.id === 'transportation'));
  const z = 13, x = Math.floor((108.224 + 180) / 360 * 2 ** z);
  const y = Math.floor((1 - Math.asinh(Math.tan(16.061 * Math.PI / 180)) / Math.PI) / 2 * 2 ** z);
  assert.ok((await reader.getZxy(z, x, y)).data.byteLength > 1000);
});
