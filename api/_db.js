import { Pool } from 'pg';
import fs from 'fs/promises';
import bcrypt from 'bcryptjs';

let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

const ensurePool = () => {
  if (!pool) throw new Error('No DATABASE_URL configured');
  return pool;
};

export async function query(text, params) {
  const p = ensurePool();
  const res = await p.query(text, params);
  return res;
}

export async function runMigrationsIfNeeded() {
  if (!pool) return { ran: false, reason: 'no-pool' };

  const sql = await fs.readFile(new URL('../migrations/001_create_tables.sql', import.meta.url), 'utf8');
  await pool.query(sql);

  try {
    const userCheck = await pool.query("SELECT id FROM admin_users WHERE username = $1", [process.env.ADMIN_USER || 'admin']);
    if (!userCheck.rowCount) {
      const defaultPass = process.env.ADMIN_PASS || 'jameslevinn';
      const hash = await bcrypt.hash(defaultPass, 10);
      await pool.query('INSERT INTO admin_users(username,password_hash,created_at,updated_at) VALUES($1,$2,now(),now())', [process.env.ADMIN_USER || 'admin', hash]);
    }
  } catch (err) {
    // ignore errors from missing admin_users or other transient state; migration file includes IF NOT EXISTS
  }
  return { ran: true, reason: 'migrations' };
}

// Reuse pool across invocations when possible
export { pool };
