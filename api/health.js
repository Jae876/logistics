import { pool, runMigrationsIfNeeded } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (pool) {
      const result = await runMigrationsIfNeeded();
      return res.json({ ok: true, database: 'connected', migration: result });
    }
    return res.json({ ok: true, database: 'not-configured' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
  }
}
