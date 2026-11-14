import maplibregl from 'maplibre-gl';
import { PMTiles, FileSource, Protocol } from 'pmtiles';
import liberty from './openfreemap-style.json';

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

export function bindOpenFreeMapPackage(data) {
  if (!data || data.pkg.mapProvider !== 'openfreemap') return null;
  const file = new File([data.mapBlob], `mapai-openfreemap-${data.pkg.installedAt}.pmtiles`);
  const source = new FileSource(file);
  protocol.add(new PMTiles(source));
  return { key: source.getKey(), dispose: () => protocol.tiles.delete(source.getKey()) };
}

// The identical Liberty layer definitions are used in both modes. Only the
// resource locations change: public OpenFreeMap or the installed bounded extract.
export function openFreeMapStyle(binding) {
  const style = structuredClone(liberty);
  if (!binding) return style;
  const root = new URL(`${import.meta.env.BASE_URL}offline/map/`, window.location.origin + '/').href;
  style.sources.openmaptiles = {
    type: 'vector', url: `pmtiles://${binding.key}`,
    attribution: '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors',
  };
  style.sources.ne2_shaded.tiles = [`${root}earth/{z}/{x}/{y}.png`];
  style.glyphs = `${root}fonts/{fontstack}/{range}.pbf`;
  style.sprite = `${root}sprite`;
  return style;
}
