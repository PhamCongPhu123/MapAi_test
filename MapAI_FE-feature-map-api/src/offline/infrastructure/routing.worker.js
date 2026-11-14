import { RoutingEngine } from '../application/routingEngine';

let engine;
self.onmessage = ({ data }) => {
  const { id, graph, origin, destination, mode } = data;
  try {
    if (graph) engine = new RoutingEngine(graph);
    if (!engine) throw new Error('Mạng lưới đường chưa được nạp.');
    self.postMessage({ id, route: engine.route(origin, destination, mode) });
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
