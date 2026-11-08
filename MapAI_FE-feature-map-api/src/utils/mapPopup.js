export function createPlacePopup(place, onDetails, onDirections) {
  const container = document.createElement('div');
  container.className = 'p-4 bg-slate-900 text-white rounded-2xl border border-white/10 shadow-xl min-w-[220px]';
  const title = document.createElement('h3');
  title.className = 'text-sm font-bold mb-2';
  title.textContent = place.name;
  const address = document.createElement('p');
  address.className = 'text-xs text-slate-400 mb-3';
  address.textContent = place.displayName || place.address || place.location?.formattedAddress || '';
  container.append(title, address);
  const actions = document.createElement('div');
  actions.className = 'flex gap-2';
  for (const [label, handler] of [['Chi tiết', onDetails], ['Đường đi', onDirections]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'px-3 py-2 bg-blue-600 rounded-lg text-xs font-bold';
    button.textContent = label;
    button.addEventListener('click', handler);
    actions.append(button);
  }
  container.append(actions);
  return container;
}
