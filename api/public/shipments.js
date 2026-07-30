import { query, runMigrationsIfNeeded, pool } from '../_db.js';
import { seededShipments } from '../_fixtures.js';

const normalizeJsonField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const CITY_COORDS = {
  'los angeles': [34.0522, -118.2437],
  'new york': [40.7128, -74.006],
  'washington': [38.9072, -77.0369],
  'washington dc': [38.9072, -77.0369],
  'houston': [29.7604, -95.3698],
  'chicago': [41.8781, -87.6298],
  'hamburg': [53.5511, 9.9937],
  'lagos': [6.5244, 3.3792],
  'san jose': [37.3382, -121.8863]
};

const parseLatLngString = (s) => {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const lower = s.toLowerCase();
  for (const key of Object.keys(CITY_COORDS)) {
    if (lower.includes(key)) return CITY_COORDS[key];
  }
  return null;
};

const mapRow = (row) => {
  const coords = normalizeJsonField(row.coords);
  const route = normalizeJsonField(row.route);
  const derivedCoords = coords && coords.length ? coords : (parseLatLngString(row.origin) || parseLatLngString(row.destination) || [34.0522, -118.2437]);
  const derivedRoute = route && route.length ? route : [
    parseLatLngString(row.origin) || derivedCoords,
    parseLatLngString(row.destination) || [40.7128, -74.006]
  ];

  return {
    ...row,
    route: derivedRoute,
    coords: derivedCoords
  };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const requestedId = req.query?.id || (req.url ? new URL(req.url, 'http://localhost').searchParams.get('id') : '');

  if (!pool) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      return res.status(501).json({ error: 'Database not configured. Set DATABASE_URL for production deployment.' });
    }
    const shipments = seededShipments.map(mapRow);
    if (requestedId) {
      const match = shipments.find((shipment) => shipment.id.toLowerCase() === requestedId.toLowerCase());
      return res.json(match ? [match] : []);
    }
    return res.json(shipments);
  }

  try {
    await runMigrationsIfNeeded();
    if (requestedId) {
      const result = await query('SELECT * FROM shipments WHERE LOWER(id) = LOWER($1) ORDER BY created_at DESC', [requestedId]);
      return res.json(result.rows.map(mapRow));
    }
    const result = await query('SELECT * FROM shipments ORDER BY created_at DESC');
    return res.json(result.rows.map(mapRow));
  } catch (error) {
    console.error('Public shipment lookup failed:', error?.message || error);
    return res.status(500).json({ error: 'Unable to load shipment data.' });
  }
}
