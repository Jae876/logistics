import jwt from 'jsonwebtoken';
import { query, runMigrationsIfNeeded, pool } from '../_db.js';
import { seededGeofences } from '../_fixtures.js';

const SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me';

const requireAuth = (req) => {
  const auth = req.headers.authorization || req.headers['x-admin-token'];
  if (!auth) return null;
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  try {
    const decoded = jwt.verify(token, SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
};

const seededZones = [...seededGeofences];

export default async function handler(req, res) {
  try {
    if (pool) await runMigrationsIfNeeded();
    const user = requireAuth(req);
    if (!user) return res.status(403).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      if (!pool) return res.json(seededZones);
      const result = await query('SELECT * FROM geofences ORDER BY created_at DESC');
      return res.json(result.rows.map((r) => ({ ...r })));
    }

    if (req.method === 'POST') {
      if (!pool) {
        const body = req.body || {};
        const created = {
          label: body.label || 'New Zone',
          center: Array.isArray(body.center) ? body.center : [0, 0],
          radius: Number(body.radius || 0)
        };
        seededZones.unshift(created);
        return res.status(201).json(created);
      }
      const body = req.body || {};
      const result = await query('INSERT INTO geofences(label, center, radius, created_at) VALUES($1,$2,$3, now()) RETURNING *', [body.label, JSON.stringify(body.center || []), body.radius || 0]);
      return res.status(201).json(result.rows[0]);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin geofences handler error:', error?.message || error);
    res.status(500).json({ error: 'Unable to process geofence request.' });
  }
}
