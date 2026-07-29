import { query, runMigrationsIfNeeded, pool } from '../_db.js';
import { seededGeofences } from '../_fixtures.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!pool) {
    return res.json(seededGeofences);
  }

  try {
    await runMigrationsIfNeeded();
    const result = await query('SELECT * FROM geofences ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r })));
  } catch (error) {
    console.error('Public geofence lookup failed:', error?.message || error);
    return res.status(500).json({ error: 'Unable to load geofence data.' });
  }
}
