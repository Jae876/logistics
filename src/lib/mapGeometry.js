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

const sanitizeCoordinate = (value) => {
  const parsed = parseMaybeJson(value);
  if (!Array.isArray(parsed) || parsed.length < 2) return null;
  const [lat, lng] = parsed;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  return [lat, lng];
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
