import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
  if (!pool) return res.status(501).json({ error: 'User management requires a database.' });
  await runMigrationsIfNeeded();
  const user = requireAuth(req);
  if (!user) return res.status(403).json({ error: 'Unauthorized' });

  if (req.method === 'PUT') {
    const body = req.body || {};
    const newPassword = body.newPassword;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const username = user.sub;
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await query('UPDATE admin_users SET password_hash = $1, updated_at = now() WHERE username = $2 RETURNING username', [hash, username]);
    if (!result.rowCount) return res.status(404).json({ error: 'Admin user not found' });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
