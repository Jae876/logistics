const DEFAULT_CENTER = [34.0522, -118.2437];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const sanitizeCoordinate = (value) => {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [lat, lng] = value;
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
    const route = Array.isArray(shipment?.route)
      ? shipment.route
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
