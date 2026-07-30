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

const mapRow = (row) => ({
  ...row,
  route: normalizeJsonField(row.route),
  coords: normalizeJsonField(row.coords)
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const requestedId = req.query?.id || (req.url ? new URL(req.url, 'http://localhost').searchParams.get('id') : '');

  if (!pool) {
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
      if (result.rows && result.rows.length > 0) return res.json(result.rows.map(mapRow));
      // fallback to seeded fixtures when DB has no matching entry
      const match = seededShipments.find((s) => s.id.toLowerCase() === requestedId.toLowerCase());
      return res.json(match ? [mapRow(match)] : []);
    }
    const result = await query('SELECT * FROM shipments ORDER BY created_at DESC');
    if (result.rows && result.rows.length > 0) return res.json(result.rows.map(mapRow));
    // if DB empty, return seeded fixtures as a fallback
    return res.json(seededShipments.map(mapRow));
  } catch (error) {
    console.error('Public shipment lookup failed:', error?.message || error);
    return res.status(500).json({ error: 'Unable to load shipment data.' });
  }
}
