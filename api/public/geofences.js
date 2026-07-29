import { query, runMigrationsIfNeeded, pool } from '../_db.js';
import { SAMPLE_GEOFENCES } from '../_samples.js';

export default async function handler(req, res) {
  if (pool) await runMigrationsIfNeeded();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (pool) {
    const result = await query('SELECT * FROM geofences ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r })));
  }
  return res.json(SAMPLE_GEOFENCES);
}
