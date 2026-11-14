export function createRoutingClient() {
  let worker, graphRef, nextId = 0;
  const requests = new Map();
  return { route(graph, origin, destination, mode) {
    if (!worker) {
      worker = new Worker(new URL('./routing.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        const pending = requests.get(data.id); requests.delete(data.id);
        if (data.error) pending?.reject(new Error(data.error)); else pending?.resolve(data.route);
      };
      worker.onerror = () => {
        requests.forEach(p => p.reject(new Error('Không khởi chạy được bộ tính đường. Hãy thử lại.')));
        requests.clear(); worker.terminate(); worker = undefined; graphRef = undefined;
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++nextId; requests.set(id, { resolve, reject });
      worker.postMessage({ id, graph: graphRef === graph ? undefined : graph, origin, destination, mode }); graphRef = graph;
    });
  } };
}
