const DEFAULT_CENTER = [34.0522, -118.2437];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getPointFromObject = (value) => {
  if (!value || typeof value !== 'object') return null;
  const lat = value.lat ?? value.latitude ?? value.y ?? value[0];
  const lng = value.lng ?? value.longitude ?? value.x ?? value[1];
  if (isFiniteNumber(lat) && isFiniteNumber(lng)) return [lat, lng];
  return null;
};

const sanitizeCoordinate = (value) => {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed) && parsed.length >= 2) {
    const rawLat = parsed[0];
    const rawLng = parsed[1];
    const lat = typeof rawLat === 'string' ? Number(rawLat) : rawLat;
    const lng = typeof rawLng === 'string' ? Number(rawLng) : rawLng;
    if (isFiniteNumber(lat) && isFiniteNumber(lng)) return [lat, lng];
  }
  const objectPoint = getPointFromObject(parsed);
  if (objectPoint) return objectPoint;
  return null;
};

export const sanitizeCoordinatePair = (value) => {
  const sanitized = sanitizeCoordinate(value);
  return sanitized || DEFAULT_CENTER;
};

export const sanitizeShipments = (shipments) => {
  if (!Array.isArray(shipments)) return [];

  return shipments.map((shipment) => {
    const coords = sanitizeCoordinate(shipment?.coords);
    const routeSource = typeof shipment?.route === 'string' ? parseMaybeJson(shipment.route) : shipment?.route;
    const route = Array.isArray(routeSource)
      ? routeSource
          .map((point) => sanitizeCoordinate(point))
          .filter(Boolean)
      : [];

    return {
      ...shipment,
      coords: coords || DEFAULT_CENTER,
      route
    };
  });
};

export const sanitizeGeofences = (geofences) => {
  if (!Array.isArray(geofences)) return [];

  return geofences.map((zone) => ({
    ...zone,
    center: sanitizeCoordinate(zone?.center) || DEFAULT_CENTER,
    radius: Number.isFinite(Number(zone?.radius)) ? Number(zone.radius) : 0
  }));
};
