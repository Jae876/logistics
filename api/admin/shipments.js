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
    const result = await query('SELECT * FROM shipments ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r, route: r.route || [], coords: r.coords || [] })));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const id = body.id || `TRK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const q = `INSERT INTO shipments(id,status,origin,destination,eta,service,weight,rate,progress,coords,route,sender_name,sender_email,sender_phone,sender_address,receiver_name,receiver_email,receiver_phone,receiver_address,package_description,carrier_name,carrier_reference,quantity,payment_mode,shipment_mode,dispatch_date,delivery_date,delivery_time,tracking_image,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29, now(), now()) RETURNING *`;
    const params = [
      id,
      body.status || 'Pending confirmation',
      body.origin || '',
      body.destination || '',
      body.eta || null,
      body.service || null,
      body.weight || null,
      body.rate || null,
      body.progress || 0,
      JSON.stringify(body.coords || []),
      JSON.stringify(body.route || []),
      body.senderName || null,
      body.senderEmail || null,
      body.senderPhone || null,
      body.senderAddress || null,
      body.receiverName || null,
      body.receiverEmail || null,
      body.receiverPhone || null,
      body.receiverAddress || null,
      body.packageDescription || null,
      body.carrierName || null,
      body.carrierReference || null,
      body.quantity || null,
      body.paymentMode || null,
      body.shipmentMode || null,
      body.dispatchDate || null,
      body.deliveryDate || null,
      body.deliveryTime || null,
      body.trackingImage || null
    ];
    const result = await query(q, params);
    return res.status(201).json(result.rows[0]);
  }

  if (req.method === 'PUT') {
    const id = req.query.id || (req.url && new URL(req.url, 'http://localhost').searchParams.get('id'));
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const body = req.body || {};
    const fields = [];
    const params = [];
    let idx = 1;
    const mapping = {
      senderName: 'sender_name', senderEmail: 'sender_email', senderPhone: 'sender_phone', senderAddress: 'sender_address',
      receiverName: 'receiver_name', receiverEmail: 'receiver_email', receiverPhone: 'receiver_phone', receiverAddress: 'receiver_address',
      packageDescription: 'package_description', carrierName: 'carrier_name', carrierReference: 'carrier_reference'
    };
    for (const key of Object.keys(body)) {
      const col = mapping[key] || key;
      if (['status','origin','destination','eta','service','weight','rate','progress','coords','route','sender_name','sender_email','sender_phone','sender_address','receiver_name','receiver_email','receiver_phone','receiver_address','package_description','carrier_name','carrier_reference','quantity','payment_mode','shipment_mode','dispatch_date','delivery_date','delivery_time','tracking_image'].includes(col)) {
        fields.push(`${col} = $${idx}`);
        params.push(['coords','route'].includes(key) ? JSON.stringify(body[key]) : body[key]);
        idx += 1;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No updatable fields' });
    params.push(id);
    const q = `UPDATE shipments SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
    const result = await query(q, params);
    if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
    return res.json(result.rows[0]);
  }

  if (req.method === 'DELETE') {
    const id = req.query.id || (req.url && new URL(req.url, 'http://localhost').searchParams.get('id'));
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await query('DELETE FROM shipments WHERE id = $1', [id]);
    return res.status(204).end();
  }

  res.status(405).json({ error: 'Method not allowed' });
}
