function coordinate(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && !value.trim()) return NaN;
  return Number(value);
}

// APIs name latitude/longitude; MapLibre and GeoJSON always use [longitude, latitude].
export function toLngLat(place) {
  const lng = coordinate(place?.longitude ?? place?.lng ?? place?.lon);
  const lat = coordinate(place?.latitude ?? place?.lat);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
    ? [lng, lat] : null;
}

export function placesGeoJSON(places) {
  return { type: 'FeatureCollection', features: places.flatMap(place => {
    const coordinates = toLngLat(place);
    return coordinates ? [{ type: 'Feature', id: place.id, properties: { id: place.id, title: place.title },
      geometry: { type: 'Point', coordinates } }] : [];
  }) };
}
