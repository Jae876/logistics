const ORS_API_KEY = process.env.ORS_API_KEY || '';
const ORS_GEOCODE_URL = 'https://api.openrouteservice.org/geocode/search';
const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

const hasOrsKey = Boolean(ORS_API_KEY);

const parseOrsCoordinates = (coords) => {
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return [lat, lng];
};

export async function geocodeAddress(address) {
  if (!hasOrsKey || !address || typeof address !== 'string') return null;
  const url = new URL(ORS_GEOCODE_URL);
  url.searchParams.set('api_key', ORS_API_KEY);
  url.searchParams.set('text', address);
  url.searchParams.set('size', '1');

  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const feature = payload?.features?.[0];
  if (!feature) return null;
  return parseOrsCoordinates(feature.geometry?.coordinates);
}

export async function getRouteFromOrs(origin, destination) {
  if (!hasOrsKey || !origin || !destination) return null;
  const body = {
    coordinates: [
      [origin[1], origin[0]],
      [destination[1], destination[0]]
    ],
    geometry: true,
    instructions: false,
    units: 'km'
  };

  const response = await fetch(ORS_DIRECTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: ORS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const coords = payload?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;

  return coords
    .map((pair) => parseOrsCoordinates(pair))
    .filter(Boolean);
}

export function isOpenRouteServiceConfigured() {
  return hasOrsKey;
}
