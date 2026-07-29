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
  // Check if shipments table exists
  const check = await pool.query(`
    SELECT to_regclass('public.shipments') as reg
  `);
  if (check.rows && check.rows[0] && check.rows[0].reg) {
    // still ensure admin user exists
    try {
      const userCheck = await pool.query("SELECT id FROM admin_users WHERE username = $1", [process.env.ADMIN_USER || 'admin']);
      if (!userCheck.rowCount) {
        const defaultPass = process.env.ADMIN_PASS || 'jameslevinn';
        const hash = await bcrypt.hash(defaultPass, 10);
        await pool.query('INSERT INTO admin_users(username,password_hash,created_at,updated_at) VALUES($1,$2,now(),now())', [process.env.ADMIN_USER || 'admin', hash]);
      }
    } catch (err) {
      // ignore
    }
    return { ran: false, reason: 'already' };
  }

  const sql = await fs.readFile(new URL('../migrations/001_create_tables.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  // ensure default admin exists
  try {
    const userCheck = await pool.query("SELECT id FROM admin_users WHERE username = $1", [process.env.ADMIN_USER || 'admin']);
    if (!userCheck.rowCount) {
      const defaultPass = process.env.ADMIN_PASS || 'jameslevinn';
      const hash = await bcrypt.hash(defaultPass, 10);
      await pool.query('INSERT INTO admin_users(username,password_hash,created_at,updated_at) VALUES($1,$2,now(),now())', [process.env.ADMIN_USER || 'admin', hash]);
    }
  } catch (err) {
    // ignore
  }
  return { ran: true };
}

// Reuse pool across invocations when possible
export { pool };
