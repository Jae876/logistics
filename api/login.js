import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool, query, runMigrationsIfNeeded } from './_db.js';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'jameslevinn';
const SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { user, pass } = req.body || {};
  if (!user || !pass) return res.status(400).json({ error: 'Missing credentials' });

  if (pool) {
    try {
      await runMigrationsIfNeeded();
      const result = await query('SELECT * FROM admin_users WHERE username = $1', [user]);
      if (result.rowCount) {
        const row = result.rows[0];
        const ok = await bcrypt.compare(pass, row.password_hash);
        if (ok) {
          const token = jwt.sign({ sub: user }, SECRET, { expiresIn: '8h' });
          return res.json({ token });
        }
      }
    } catch (error) {
      console.error('Login handler DB error:', error?.message || error);
    }

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      const token = jwt.sign({ sub: user }, SECRET, { expiresIn: '8h' });
      return res.json({ token });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // fallback to env credentials for local dev
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    const token = jwt.sign({ sub: user }, SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
}
