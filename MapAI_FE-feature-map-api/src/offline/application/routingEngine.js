import { distanceMeters, inBounds } from './searchEngine.js';

class MinHeap {
  items = [];
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].priority <= item.priority) break;
      a[i] = a[p]; i = p;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].priority < a[c].priority) c++;
        if (a[c].priority >= last.priority) break;
        a[i] = a[c]; i = c;
      }
      a[i] = last;
    }
    return first;
  }
}

const asPoint = ([lng, lat]) => ({ lng, lat });
function turnLabel(previous, current) {
  const bearing = (a, b) => Math.atan2((b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI;
  const delta = (bearing(...current) - bearing(...previous) + 540) % 360 - 180;
  return Math.abs(delta) < 35 ? 'Tiếp tục trên' : delta > 0 ? 'Rẽ phải vào' : 'Rẽ trái vào';
}

export class RoutingEngine {
  constructor(graph) {
    this.graph = graph;
    this.networks = {};
  }
  network(mode) {
    if (this.networks[mode]) return this.networks[mode];
    const g = this.graph;
    const adjacency = Array.from({ length: g.nodes.length }, () => []);
    const incoming = new Uint8Array(g.nodes.length);
    const components = Int32Array.from({ length: g.nodes.length }, (_, i) => i);
    const find = i => { while (components[i] !== i) { components[i] = components[components[i]]; i = components[i]; } return i; };
    const forward = mode === 'foot' ? 1 : 4, reverse = mode === 'foot' ? 2 : 8;
    for (const [a, b, name, flags] of g.edges) {
      const length = distanceMeters(asPoint(g.nodes[a]), asPoint(g.nodes[b]));
      if (flags & (forward | reverse)) components[find(a)] = find(b);
      if (flags & forward) { adjacency[a].push({ to: b, name, length }); incoming[b] = 1; }
      if (flags & reverse) { adjacency[b].push({ to: a, name, length }); incoming[a] = 1; }
    }
    for (let i = 0; i < components.length; i++) components[i] = find(i);
    return this.networks[mode] = { adjacency, incoming, components };
  }
  route(origin, destination, mode = 'foot') {
    const g = this.graph;
    if (!inBounds(origin, g.bounds) || !inBounds(destination, g.bounds)) {
      throw new Error('Điểm xuất phát hoặc điểm đến nằm ngoài gói trung tâm Đà Nẵng. Hãy chọn điểm khác trong khung bản đồ.');
    }
    if (!['foot', 'motorbike'].includes(mode)) throw new Error('Phương tiện không được hỗ trợ.');
    const { adjacency, incoming, components } = this.network(mode);
    const nearestByComponent = (point, isStart) => {
      const candidates = new Map();
      g.nodes.forEach((node, i) => {
        if (!(isStart ? adjacency[i].length : incoming[i])) return;
        const d = distanceMeters(point, asPoint(node));
        const component = components[i];
        if (d <= 350 && d < (candidates.get(component)?.distance ?? Infinity)) candidates.set(component, { id: i, distance: d });
      });
      if (!candidates.size) throw new Error('Điểm đã chọn cách mạng lưới đường hơn 350 m. Chọn điểm gần đường hoặc một mốc phổ biến.');
      return candidates;
    };
    const starts = nearestByComponent(origin, true), ends = nearestByComponent(destination, false);
    let start, end, accessCost = Infinity;
    for (const [component, candidate] of starts) {
      const target = ends.get(component);
      if (target && candidate.distance + target.distance < accessCost) {
        start = candidate; end = target; accessCost = candidate.distance + target.distance;
      }
    }
    if (!start) throw new Error('Hai điểm chưa nối với cùng mạng lưới đường trong gói. Chọn mốc khác hoặc thử đi bộ.');
    const costs = new Float64Array(g.nodes.length).fill(Infinity);
    const parents = new Int32Array(g.nodes.length).fill(-1);
    const edgeNames = new Int32Array(g.nodes.length).fill(-1);
    const heap = new MinHeap();
    costs[start.id] = 0;
    heap.push({ id: start.id, cost: 0, priority: 0 });
    let reached = false;
    while (heap.items.length) {
      const { id, cost } = heap.pop();
      if (cost > costs[id]) continue;
      if (id === end.id) { reached = true; break; }
      for (const edge of adjacency[id]) {
        const nextCost = cost + edge.length;
        if (nextCost >= costs[edge.to]) continue;
        costs[edge.to] = nextCost; parents[edge.to] = id; edgeNames[edge.to] = edge.name;
        heap.push({ id: edge.to, cost: nextCost,
          priority: nextCost + distanceMeters(asPoint(g.nodes[edge.to]), asPoint(g.nodes[end.id])) });
      }
    }
    if (!reached) throw new Error('Chưa có tuyến đường nối hai điểm trong dữ liệu đã tải. Hãy thử đi bộ hoặc đổi điểm xuất phát.');
    const path = [];
    for (let i = end.id; i !== -1; i = parents[i]) path.push(i);
    path.reverse();
    const coordinates = path.map(i => g.nodes[i]);
    const steps = [];
    let previousSegment;
    for (let i = 1; i < path.length; i++) {
      const segment = [coordinates[i - 1], coordinates[i]];
      const length = distanceMeters(asPoint(segment[0]), asPoint(segment[1]));
      const name = g.names[edgeNames[path[i]]];
      if (steps.at(-1)?.name === name) steps.at(-1).distance += length;
      else steps.push({ name, location: segment[0], distance: length, instruction: previousSegment ? `${turnLabel(previousSegment, segment)} ${name}` : `Đi theo ${name}` });
      previousSegment = segment;
    }
    const accessDistance = start.distance + end.distance;
    const roadDistance = costs[end.id];
    return { mode, origin, destination, coordinates, steps, roadDistance, accessDistance,
      distance: roadDistance + accessDistance,
      minutes: Math.max(1, Math.ceil(roadDistance / (mode === 'foot' ? 4500 : 25000) * 60 + accessDistance / 4500 * 60)),
      access: [[[origin.lng, origin.lat], g.nodes[start.id]], [g.nodes[end.id], [destination.lng, destination.lat]]],
    };
  }
}
