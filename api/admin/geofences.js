import jwt from 'jsonwebtoken';
import { query, runMigrationsIfNeeded, pool } from '../_db.js';

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

export default async function handler(req, res) {
  if (pool) await runMigrationsIfNeeded();
  const user = requireAuth(req);
  if (!user) return res.status(403).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const result = await query('SELECT * FROM geofences ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r })));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const result = await query('INSERT INTO geofences(label, center, radius, created_at) VALUES($1,$2,$3, now()) RETURNING *', [body.label, JSON.stringify(body.center || []), body.radius || 0]);
    return res.status(201).json(result.rows[0]);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
