import { query, runMigrationsIfNeeded, pool } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured for serverless shipment lookup.' });
  }

  try {
    await runMigrationsIfNeeded();
    const result = await query('SELECT * FROM shipments ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r, route: r.route || [], coords: r.coords || [] })));
  } catch (error) {
    console.error('Public shipment lookup failed:', error?.message || error);
    return res.status(500).json({ error: 'Unable to load shipment data.' });
  }
}
