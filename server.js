import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_CREDENTIALS = { user: 'admin', pass: 'supersecure' };
let adminToken = null;

const generateToken = () => Math.random().toString(36).slice(2);

// Postgres pool (Neon) when DATABASE_URL is provided
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

// Fallback in-memory sample data used when no DB connected
const SAMPLE_SHIPMENTS = [
  {
    id: 'DGS-100001',
    status: 'In transit',
    origin: 'Los Angeles, CA',
    destination: 'New York, NY',
    eta: '2026-09-18',
    service: 'Air Freight',
    weight: '2,200 KG',
    rate: '$18,500',
    progress: 60,
    coords: [34.0522, -118.2437],
    route: [
      [34.0522, -118.2437],
      [39.0997, -94.5786],
      [40.7128, -74.0060]
    ]
  },
  {
    id: 'DGS-100002',
    status: 'Customs clearance',
    origin: 'Hamburg, Germany',
    destination: 'Lagos, Nigeria',
    eta: '2026-09-24',
    service: 'Sea Freight',
    weight: '4,800 KG',
    rate: '$9,200',
    progress: 35,
    coords: [53.5511, 9.9937],
    route: [
      [53.5511, 9.9937],
      [46.2044, 6.1432],
      [6.5244, 3.3792]
    ]
  }
];

const SAMPLE_GEOFENCES = [
  { label: 'East Coast Hub', center: [40.7128, -74.0060], radius: 18000 },
  { label: 'Atlantic Corridor', center: [43.0000, -60.0000], radius: 280000 }
];

let shipments = [...SAMPLE_SHIPMENTS];
let geofences = [...SAMPLE_GEOFENCES];

const createShipment = (body) => {
  const id = body.id || `TRK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const start = [34.0522, -118.2437];
  const end = [40.7128, -74.0060];
  const route = [start, [(start[0] + end[0]) / 2 + 1, (start[1] + end[1]) / 2 - 10], end];

  return {
    id,
    status: body.status || 'Pending confirmation',
    origin: body.origin || 'Unknown origin',
    destination: body.destination || 'Unknown destination',
    eta: body.eta || 'TBD',
    service: body.service || 'Freight',
    weight: body.weight || 'N/A',
    rate: body.rate || 'N/A',
    progress: 0,
    coords: start,
    route,
    senderName: body.senderName || '',
    senderEmail: body.senderEmail || '',
    senderPhone: body.senderPhone || '',
    senderAddress: body.senderAddress || '',
    receiverName: body.receiverName || '',
    receiverEmail: body.receiverEmail || '',
    receiverPhone: body.receiverPhone || '',
    receiverAddress: body.receiverAddress || '',
    packageDescription: body.packageDescription || '',
    carrierName: body.carrierName || '',
    carrierReference: body.carrierReference || '',
    quantity: body.quantity || '',
    paymentMode: body.paymentMode || '',
    shipmentMode: body.shipmentMode || '',
    deliveryTime: body.deliveryTime || '',
    trackingImage: body.trackingImage || ''
  };
};

app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === ADMIN_CREDENTIALS.user && pass === ADMIN_CREDENTIALS.pass) {
    adminToken = generateToken();
    return res.json({ token: adminToken });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token'] || (typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);
  if (token === adminToken) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized' });
};

app.get('/api/shipments', requireAdmin, async (req, res) => {
  if (pool) {
    const result = await pool.query('SELECT * FROM shipments ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r, route: r.route || [], coords: r.coords || [] })));
  }
  return res.json(shipments);
});

app.post('/api/shipments', requireAdmin, async (req, res) => {
  const shipment = createShipment(req.body);
  if (pool) {
    const q = `INSERT INTO shipments(id, status, origin, destination, eta, service, weight, rate, progress, coords, route, sender_name, sender_email, sender_phone, sender_address, receiver_name, receiver_email, receiver_phone, receiver_address, package_description, carrier_name, carrier_reference, quantity, payment_mode, shipment_mode, dispatch_date, delivery_date, delivery_time, tracking_image, created_at, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29, now(), now()) RETURNING *`;
    const params = [
      shipment.id,
      shipment.status,
      shipment.origin,
      shipment.destination,
      shipment.eta,
      shipment.service,
      shipment.weight,
      shipment.rate,
      shipment.progress,
      JSON.stringify(shipment.coords),
      JSON.stringify(shipment.route),
      shipment.senderName,
      shipment.senderEmail,
      shipment.senderPhone,
      shipment.senderAddress,
      shipment.receiverName,
      shipment.receiverEmail,
      shipment.receiverPhone,
      shipment.receiverAddress,
      shipment.packageDescription,
      shipment.carrierName,
      shipment.carrierReference,
      shipment.quantity,
      shipment.paymentMode,
      shipment.shipmentMode,
      shipment.dispatchDate || null,
      shipment.deliveryDate || null,
      shipment.deliveryTime || null,
      shipment.trackingImage || null
    ];
    const result = await pool.query(q, params);
    return res.status(201).json(result.rows[0]);
  }
  shipments.unshift(shipment);
  res.status(201).json(shipment);
});

app.put('/api/shipments/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    const fields = [];
    const params = [];
    let idx = 1;
    for (const key of Object.keys(req.body)) {
      // allow only known fields
      if (['status','origin','destination','eta','service','weight','rate','progress','coords','route','senderName','senderEmail','senderPhone','senderAddress','receiverName','receiverEmail','receiverPhone','receiverAddress','packageDescription','carrierName','carrierReference','quantity','paymentMode','shipmentMode','dispatchDate','deliveryDate','deliveryTime','trackingImage'].includes(key)) {
        const col = key === 'senderName' ? 'sender_name' : key === 'senderEmail' ? 'sender_email' : key === 'senderPhone' ? 'sender_phone' : key === 'senderAddress' ? 'sender_address' : key === 'receiverName' ? 'receiver_name' : key === 'receiverEmail' ? 'receiver_email' : key === 'receiverPhone' ? 'receiver_phone' : key === 'receiverAddress' ? 'receiver_address' : key === 'packageDescription' ? 'package_description' : key === 'carrierName' ? 'carrier_name' : key === 'carrierReference' ? 'carrier_reference' : key;
        fields.push(`${col} = $${idx}`);
        params.push(['coords','route'].includes(key) ? JSON.stringify(req.body[key]) : req.body[key]);
        idx += 1;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No updatable fields' });
    params.push(id);
    const q = `UPDATE shipments SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(q, params);
    if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
    return res.json(result.rows[0]);
  }
  const index = shipments.findIndex((shipment) => shipment.id === id);
  if (index < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  shipments[index] = { ...shipments[index], ...req.body };
  res.json(shipments[index]);
});

app.delete('/api/shipments/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    const result = await pool.query('DELETE FROM shipments WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(204).end();
  }
  const index = shipments.findIndex((shipment) => shipment.id === id);
  if (index < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  shipments.splice(index, 1);
  res.status(204).end();
});

app.get('/api/geofences', requireAdmin, async (req, res) => {
  if (pool) {
    const result = await pool.query('SELECT * FROM geofences ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r })));
  }
  return res.json(geofences);
});

app.post('/api/geofences', requireAdmin, async (req, res) => {
  const zone = req.body;
  if (pool) {
    const result = await pool.query('INSERT INTO geofences(label, center, radius, created_at) VALUES($1,$2,$3, now()) RETURNING *', [zone.label, JSON.stringify(zone.center), zone.radius]);
    return res.status(201).json(result.rows[0]);
  }
  geofences.push(zone);
  res.status(201).json(zone);
});

app.get('/api/public/shipments', async (req, res) => {
  if (pool) {
    const result = await pool.query('SELECT * FROM shipments ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r, route: r.route || [], coords: r.coords || [] })));
  }
  return res.json(shipments);
});

app.get('/api/public/geofences', async (req, res) => {
  if (pool) {
    const result = await pool.query('SELECT * FROM geofences ORDER BY created_at DESC');
    return res.json(result.rows.map((r) => ({ ...r })));
  }
  return res.json(geofences);
});

// If using DB, attempt to preload data
const start = async () => {
  if (pool) {
    try {
      const s = await pool.query('SELECT * FROM shipments ORDER BY created_at DESC LIMIT 100');
      shipments = s.rows.map((r) => ({ ...r, route: r.route || [], coords: r.coords || [] }));
      const g = await pool.query('SELECT * FROM geofences ORDER BY created_at DESC LIMIT 100');
      geofences = g.rows.map((r) => ({ ...r }));
      console.log('Loaded data from Postgres');
    } catch (err) {
      console.warn('Error loading DB data, falling back to in-memory samples', err.message || err);
    }
  }

  app.listen(4000, () => {
    console.log('Backend running on http://localhost:4000');
  });
};

start();