import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import QRCode from 'qrcode';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { sanitizeGeofences, sanitizeShipments } from './lib/mapGeometry';

type Shipment = {
  id: string;
  status: string;
  origin: string;
  destination: string;
  eta: string;
  service: string;
  weight: string;
  rate: string;
  progress: number;
  coords: [number, number];
  route: [number, number][];
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  senderAddress?: string;
  receiverName?: string;
  receiverEmail?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  packageDescription?: string;
  carrierName?: string;
  carrierReference?: string;
  quantity?: string;
  paymentMode?: string;
  shipmentMode?: string;
  dispatchDate?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  trackingImage?: string;
  outstanding_fee?: string;
  outstandingFee?: string;
};

type GeofenceZone = {
  label: string;
  center: [number, number];
  radius: number;
};

type AdminCredentials = {
  user: string;
  pass: string;
};

type TrackingFormData = {
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverEmail: string;
  receiverPhone: string;
  receiverAddress: string;
  packageDescription: string;
  carrierName: string;
  carrierReference: string;
  origin: string;
  destination: string;
  dispatchDate: string;
  deliveryDate: string;
  eta: string;
  service: string;
  weight: string;
  rate: string;
  quantity: string;
  paymentMode: string;
  shipmentMode: string;
  deliveryTime: string;
  status: string;
  trackingImage: string;
  route: string;
  coords: string;
  outstandingFee: string;
};

type NewZoneData = {
  label: string;
  lat: string;
  lng: string;
  radius: string;
};

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const liveMarkerIcon = L.divIcon({
  className: 'live-marker-icon',
  html: '<span class="live-marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -14]
});

const originIcon = L.divIcon({
  className: 'route-marker-icon origin-marker',
  html: '<span>O</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14]
});

const destinationIcon = L.divIcon({
  className: 'route-marker-icon destination-marker',
  html: '<span>D</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14]
});

const waypointIcon = L.divIcon({
  className: 'waypoint-pin',
  html: '<span class="waypoint-dot"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const defaultTrackingForm: TrackingFormData = {
  senderName: 'John Doe',
  senderEmail: 'johndoe@globalmail.com',
  senderPhone: '08000000000',
  senderAddress: 'No 12 House Kofra',
  receiverName: 'Monica King',
  receiverEmail: 'monicakgsolutions@gmail.com',
  receiverPhone: '07000000000',
  receiverAddress: 'House 1, 2 UN St',
  packageDescription: 'Electronics and machinery components',
  carrierName: 'DHL',
  carrierReference: 'DHL-678934',
  origin: 'Los Angeles, CA',
  destination: 'New York, NY',
  dispatchDate: '2026-09-18',
  deliveryDate: '2026-09-24',
  eta: '2026-09-24',
  service: 'Air Freight',
  weight: '2,200 KG',
  rate: '$18,500',
  quantity: '120',
  paymentMode: 'Prepaid',
  shipmentMode: 'Air Freight',
  deliveryTime: '08:00',
  status: 'Pending confirmation',
  trackingImage: ''
  ,
  outstandingFee: '$0',
  // route stored as JSON string in the form; admin can paste a JSON array of [lat, lng]
  route: JSON.stringify([[34.0522, -118.2437], [40.7128, -74.006]], null, 2),
  coords: JSON.stringify([34.0522, -118.2437])
};

const defaultNewZone: NewZoneData = {
  label: 'East Coast Hub',
  lat: '40.7128',
  lng: '-74.0060',
  radius: '18000'
};

const defaultMapCenter: [number, number] = [34.0522, -118.2437];

const isCoordinatePair = (value: unknown): value is [number, number] => {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && Number.isFinite(value[0]) && typeof value[1] === 'number' && Number.isFinite(value[1]);
};

const getValidRoute = (route: unknown): [number, number][] => {
  if (!Array.isArray(route)) return [];
  return route.filter(isCoordinatePair);
};

// Smooth a polyline using Catmull-Rom spline interpolation to produce a natural-looking route
const smoothRoute = (points: [number, number][], segmentsPerSegment = 8): [number, number][] => {
  if (!Array.isArray(points) || points.length < 2) return points || [];

  const p = points.slice();
  const out: [number, number][] = [];

  const catmullRom = (t: number, p0: number, p1: number, p2: number, p3: number) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };

  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = i === 0 ? p[i] : p[i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = i + 2 < p.length ? p[i + 2] : p[i + 1];

    for (let s = 0; s < segmentsPerSegment; s += 1) {
      const t = s / segmentsPerSegment;
      const lat = catmullRom(t, p0[0], p1[0], p2[0], p3[0]);
      const lng = catmullRom(t, p0[1], p1[1], p2[1], p3[1]);
      out.push([lat, lng]);
    }
  }
  // include the final point
  out.push(p[p.length - 1]);
  return out;
};

// Generate a pleasing curved route between two points when no detailed route is available.
const generateArcRoute = (points: [number, number][], segments = 24, curvature = 0.16): [number, number][] => {
  if (!Array.isArray(points) || points.length < 2) return points || [];
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const baseDist = Math.sqrt(dx * dx + dy * dy) || 1e-6;
  const perp = [-dy / baseDist, dx / baseDist];
  const out: [number, number][] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const lat = a[0] + dx * t;
    const lng = a[1] + dy * t;
    const offset = Math.sin(Math.PI * t) * curvature * baseDist;
    out.push([lat + perp[0] * offset, lng + perp[1] * offset]);
  }
  return out;
};

type BackgroundKey = 'default' | 'air' | 'ocean' | 'land' | 'warehouse';

const serviceCards = [
  {
    title: 'Air Freight Express',
    description: 'Rapid international shipping for time-sensitive, high-value, or perishable goods.',
    icon: '✈️',
    bgKey: 'air' as const
  },
  {
    title: 'Ocean Freight',
    description: 'Cost-effective container shipping for large volumes with comprehensive global coverage.',
    icon: '🚢',
    bgKey: 'ocean' as const
  },
  {
    title: 'Land Transport',
    description: 'Reliable road and rail transportation services for domestic and cross-border delivery.',
    icon: '🚚',
    bgKey: 'land' as const
  },
  {
    title: 'Smart Warehousing',
    description: 'Intelligent inventory staging, fulfillment orchestration, and secure facility management.',
    icon: '🏭',
    bgKey: 'warehouse' as const
  }
];

const backgroundImages: Record<BackgroundKey, string> = {
  default: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1600&q=80',
  air: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  ocean: 'https://images.unsplash.com/photo-1493517071587-1e2f8aa5bde0?auto=format&fit=crop&w=1600&q=80',
  land: 'https://images.unsplash.com/photo-1519923042980-9d99a977e02f?auto=format&fit=crop&w=1600&q=80',
  warehouse: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1600&q=80'
};

const stats = [
  { value: '25+', label: 'Years experience' },
  { value: '150+', label: 'Countries served' },
  { value: '98%', label: 'On-time delivery' },
  { value: '408', label: 'Dedicated routes' }
];

const testimonials = [
  {
    name: 'Michael Carter',
    role: 'VP of Operations',
    quote: 'Direct Global Shipping simplified our international freight and kept our shipments on schedule every time.'
  },
  {
    name: 'Jennifer Lee',
    role: 'Logistics Director',
    quote: 'Their team delivered a smooth custom clearance process and consistent visibility across all lanes.'
  },
  {
    name: 'Robert Hayes',
    role: 'Procurement Manager',
    quote: 'The shipping dashboard is professional and easy to use, giving us confidence on every shipment.'
  }
];

function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [credentials, setCredentials] = useState<AdminCredentials>({ user: '', pass: '' });
  const [selectedBackground, setSelectedBackground] = useState<BackgroundKey>('default');
  const [loginError, setLoginError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [geofences, setGeofences] = useState<GeofenceZone[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [trackingForm, setTrackingForm] = useState<TrackingFormData>(defaultTrackingForm);
  const [adminView, setAdminView] = useState<'dashboard' | 'details' | 'add-tracking' | 'account' | 'settings'>('dashboard');
  const [editingShipmentId, setEditingShipmentId] = useState('');
  const [generatedTrackingId, setGeneratedTrackingId] = useState('');
  const [newZone, setNewZone] = useState<NewZoneData>(defaultNewZone);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackedShipment, setTrackedShipment] = useState<Shipment | null>(null);
  const [isPackageImageOpen, setIsPackageImageOpen] = useState(false);

  const isAdminRoute = route === '/admin' || route === '/admin/';
  const isTrackRoute = route === '/track';
  const adminLoggedIn = Boolean(adminToken);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const fetchPublic = async () => {
      try {
        const [shipRes, geoRes] = await Promise.all([
          fetch('/api/public/shipments'),
          fetch('/api/public/geofences')
        ]);

        if (!shipRes.ok || !geoRes.ok) {
          setShipments([]);
          setGeofences([]);
          return;
        }

        const [shipData, geoData] = await Promise.all([
          shipRes.json().catch(() => null),
          geoRes.json().catch(() => null)
        ]);
        const sanitizedShipments = sanitizeShipments<Shipment>(Array.isArray(shipData) ? shipData : []);
        const sanitizedGeofences = sanitizeGeofences<GeofenceZone>(Array.isArray(geoData) ? geoData : []);
        setShipments(sanitizedShipments);
        setGeofences(sanitizedGeofences);
        const firstShipmentId = sanitizedShipments[0]?.id;
        if (!selectedShipmentId && firstShipmentId) setSelectedShipmentId(firstShipmentId);
      } catch (error) {
        setShipments([]);
        setGeofences([]);
      }
    };

    const fetchAdmin = async () => {
      if (!adminToken) return;
      try {
        const [shipRes, geoRes] = await Promise.all([
          fetch('/api/admin/shipments', { headers: getAdminHeaders() }),
          fetch('/api/admin/geofences', { headers: getAdminHeaders() })
        ]);
        if (!shipRes.ok || !geoRes.ok) {
          setAdminToken('');
          localStorage.removeItem('adminToken');
          setShipments([]);
          setGeofences([]);
          return;
        }
        const [shipData, geoData] = await Promise.all([
          shipRes.json().catch(() => null),
          geoRes.json().catch(() => null)
        ]);
        const sanitizedShipments = sanitizeShipments<Shipment>(Array.isArray(shipData) ? shipData : []);
        const sanitizedGeofences = sanitizeGeofences<GeofenceZone>(Array.isArray(geoData) ? geoData : []);
        setShipments(sanitizedShipments);
        setGeofences(sanitizedGeofences);
        const firstShipmentId = sanitizedShipments[0]?.id;
        if (!selectedShipmentId && firstShipmentId) setSelectedShipmentId(firstShipmentId);
      } catch (error) {
        setShipments([]);
        setGeofences([]);
      }
    };

    if (isAdminRoute) {
      fetchAdmin();
    } else {
      fetchPublic();
    }
  }, [route, adminToken, selectedShipmentId, isAdminRoute]);

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.id === selectedShipmentId) || shipments[0] || null,
    [shipments, selectedShipmentId]
  );

  const activeRoute = getValidRoute(selectedShipment?.route);
  const mapCenter = isCoordinatePair(selectedShipment?.coords) ? selectedShipment.coords : defaultMapCenter;
  const routeLayers = useMemo(
    () => shipments.map((shipment) => getValidRoute(shipment.route)).filter((route) => route.length > 0),
    [shipments]
  );
  const smoothedRouteLayers = useMemo(() => routeLayers.map((r) => smoothRoute(r, 6)), [routeLayers]);
  const mapBounds = useMemo(() => {
    const boundsPoints = routeLayers.length ? routeLayers.flat() : [mapCenter];
    return boundsPoints.length ? boundsPoints : [mapCenter];
  }, [routeLayers, mapCenter]);
  const selectedRouteOrigin = activeRoute[0] || mapCenter;
  const selectedRouteDestination = activeRoute[activeRoute.length - 1] || mapCenter;
  const trackedMapKey = trackedShipment ? `${trackedShipment.id}-${trackedShipment.status}` : 'track-map';
  const trackedRoute = useMemo(() => getValidRoute(trackedShipment?.route), [trackedShipment]);
  const smoothedActiveRoute = useMemo(() => {
    if (activeRoute.length <= 2) return generateArcRoute(activeRoute, 30, 0.12);
    if (activeRoute.length > 80) return activeRoute;
    return smoothRoute(activeRoute, 10);
  }, [activeRoute]);
  const smoothedTrackedRoute = useMemo(() => {
    if (trackedRoute.length <= 2) return generateArcRoute(trackedRoute, 30, 0.12);
    if (trackedRoute.length > 80) return trackedRoute;
    return smoothRoute(trackedRoute, 10);
  }, [trackedRoute]);
  const showActiveWaypoints = smoothedActiveRoute.length <= 24;
  const showTrackedWaypoints = smoothedTrackedRoute.length <= 24;
  const trackedMapBounds = useMemo(() => {
    if (trackedRoute.length > 1) return trackedRoute;
    if (trackedRoute.length === 1) return [trackedRoute[0], trackedShipment?.coords || mapCenter];
    return isCoordinatePair(trackedShipment?.coords) ? [trackedShipment.coords] : [mapCenter];
  }, [trackedRoute, trackedShipment, mapCenter]);

  const loadTrackedShipment = async (query: string) => {
    const preservedQuery = query.trim();
    if (!preservedQuery) return;

    try {
      const response = await fetch(`/api/public/shipments?id=${encodeURIComponent(preservedQuery)}`);
      if (!response.ok) return;
      const payload = await response.json();
      const latest = sanitizeShipments<Shipment>(Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : []);
      const found = latest.find((shipment) => shipment.id.toLowerCase() === preservedQuery.toLowerCase());

      if (found) {
        setShipments(latest);
        setSelectedShipmentId(found.id);
        setTrackedShipment(found);
      }
    } catch {
      // ignore failures; leave state unchanged until user search
    }
  };

  useEffect(() => {
    if (!isTrackRoute) return undefined;
    const searchParams = new URLSearchParams(window.location.search);
    const queryId = searchParams.get('id');
    if (queryId) {
      setTrackQuery(queryId);
      loadTrackedShipment(queryId);
    }

    const poll = async () => {
      const response = await fetch('/api/public/shipments');
      if (!response.ok) return;
      const shipData = await response.json();
      setShipments(sanitizeShipments<Shipment>(Array.isArray(shipData) ? shipData : []));
    };

    poll();
    const interval = window.setInterval(poll, 10000);
    return () => window.clearInterval(interval);
  }, [isTrackRoute]);

  useEffect(() => {
    if (!trackedShipment) return;
    const fresh = shipments.find((shipment) => shipment.id === trackedShipment.id);
    if (!fresh) return;

    const trackedJson = JSON.stringify({
      status: trackedShipment.status,
      origin: trackedShipment.origin,
      destination: trackedShipment.destination,
      eta: trackedShipment.eta,
      coords: trackedShipment.coords,
      route: trackedShipment.route,
      progress: trackedShipment.progress
    });
    const freshJson = JSON.stringify({
      status: fresh.status,
      origin: fresh.origin,
      destination: fresh.destination,
      eta: fresh.eta,
      coords: fresh.coords,
      route: fresh.route,
      progress: fresh.progress
    });

    if (trackedJson !== freshJson) {
      setTrackedShipment(fresh);
      setSelectedShipmentId(fresh.id);
    }
  }, [shipments, trackedShipment]);

  const navigate = (path: string) => {
    const url = new URL(window.location.href);
    if (path.startsWith('/track?id=')) {
      const [pathname, query] = path.split('?');
      url.pathname = pathname;
      url.search = query ? `?${query}` : '';
      window.history.pushState(null, '', url.toString());
      setRoute(pathname);
      return;
    }
    window.history.pushState(null, '', path);
    setRoute(path);
  };

  const getAdminHeaders = (): HeadersInit => {
    const token = adminToken || localStorage.getItem('adminToken');
    if (!token) return new Headers();
    return { 'x-admin-token': token, Authorization: `Bearer ${token}` };
  };

  const trackingUrl = (id: string) => `${window.location.origin}/track?id=${encodeURIComponent(id)}`;
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    if (!trackedShipment?.id) {
      setQrCodeDataUrl('');
      return;
    }
    const url = trackingUrl(trackedShipment.id);
    QRCode.toDataURL(url, { errorCorrectionLevel: 'H', width: 260 })
      .then((dataUrl) => setQrCodeDataUrl(dataUrl))
      .catch(() => setQrCodeDataUrl(''));
  }, [trackedShipment?.id]);

  const getShipmentTimeline = (status: string) => {
    const normalized = status.toLowerCase();
    const order = [
      { key: 'picked_up', label: 'Picked up', description: 'Freight successfully picked up and headed to the sorting facility.', date: '2026-07-24' },
      { key: 'pending', label: 'Pending', description: 'Freight payment confirmed, order moved to processing.', date: '2026-07-26' },
      { key: 'in_transit', label: 'In transit', description: 'On schedule and moving through the network.', date: '2026-07-28' },
      { key: 'arriving_soon', label: 'Arriving soon', description: 'Preparing for last mile delivery.', date: '2026-07-30' },
      { key: 'delivered', label: 'Delivered', description: 'Shipment delivered to destination.', date: '2026-08-01' }
    ];

    const getCurrentKey = () => {
      if (normalized.includes('picked up')) return 'picked_up';
      if (normalized.includes('customs clearance') || normalized.includes('customs') || normalized.includes('clearance')) return 'arriving_soon';
      if (normalized.includes('pending') || normalized.includes('confirmation')) return 'pending';
      if (normalized.includes('in transit') || normalized.includes('transit')) return 'in_transit';
      if (normalized.includes('arriving soon') || normalized.includes('arriving') || normalized.includes('on schedule')) return 'arriving_soon';
      if (normalized.includes('delivered')) return 'delivered';
      return 'pending';
    };

    const currentKey = getCurrentKey();
    const currentIndex = order.findIndex((step) => step.key === currentKey);

    return order.map((step, index) => ({
      ...step,
      state: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'future'
    })).reverse();
  };

  const handleLogin = async () => {
    setLoginError('');
    setAdminMessage('');
    if (!credentials.user || !credentials.pass) {
      setLoginError('Admin username and password are required.');
      return;
    }

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      setLoginError('Invalid admin credentials.');
      return;
    }

    const data = await response.json();
    setAdminToken(data.token);
    localStorage.setItem('adminToken', data.token);
    setCredentials({ user: '', pass: '' });
    setAdminMessage('Admin dashboard unlocked.');
    navigate('/admin');
  };

  const generateTrackingId = () => Math.random().toString(36).slice(2, 12).toUpperCase();

  const openAddTracking = () => {
    setEditingShipmentId('');
    setTrackingForm(defaultTrackingForm);
    setGeneratedTrackingId(generateTrackingId());
    setAdminView('add-tracking');
  };

  useEffect(() => {
    if (adminView !== 'add-tracking') {
      setGeneratedTrackingId('');
    }
  }, [adminView]);

  const handleLogout = () => {
    setAdminToken('');
    localStorage.removeItem('adminToken');
    setAdminMessage('Signed out.');
    setAdminView('dashboard');
    navigate('/');
  };

  const handleCreateShipment = async () => {
    setAdminMessage('');
    if (!adminLoggedIn) return;

    const createdId = generatedTrackingId || generateTrackingId();
    const response = await fetch('/api/admin/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify({
        id: createdId,
        origin: trackingForm.origin,
        coords: trackingForm.coords,
        destination: trackingForm.destination,
        eta: trackingForm.eta,
        service: trackingForm.shipmentMode,
        weight: trackingForm.weight,
        rate: trackingForm.rate,
        outstandingFee: trackingForm.outstandingFee,
        status: trackingForm.status,
        senderName: trackingForm.senderName,
        senderEmail: trackingForm.senderEmail,
        senderPhone: trackingForm.senderPhone,
        senderAddress: trackingForm.senderAddress,
        receiverName: trackingForm.receiverName,
        receiverEmail: trackingForm.receiverEmail,
        receiverPhone: trackingForm.receiverPhone,
        receiverAddress: trackingForm.receiverAddress,
        packageDescription: trackingForm.packageDescription,
        carrierName: trackingForm.carrierName,
        carrierReference: trackingForm.carrierReference,
        quantity: trackingForm.quantity,
        paymentMode: trackingForm.paymentMode,
        shipmentMode: trackingForm.shipmentMode,
        deliveryTime: trackingForm.deliveryTime,
        trackingImage: trackingForm.trackingImage
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      setAdminMessage(err?.error || `Unable to create shipment (HTTP ${response.status})`);
      return;
    }

    const created = await response.json();
    setShipments((current) => [created, ...current]);
    setSelectedShipmentId(created.id);
    setTrackedShipment(created);
    setGeneratedTrackingId(created.id);
    setTrackingForm(defaultTrackingForm);
    setAdminView('dashboard');
    setAdminMessage(`Tracking created: ${created.id}`);
  };

  const handleUpdateShipment = async (shipmentId: string) => {
    setAdminMessage('');
    if (!adminLoggedIn) return;

    const response = await fetch(`/api/admin/shipments?id=${encodeURIComponent(shipmentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify({
        origin: trackingForm.origin,
        coords: trackingForm.coords,
        destination: trackingForm.destination,
        eta: trackingForm.eta,
        service: trackingForm.shipmentMode,
        weight: trackingForm.weight,
        rate: trackingForm.rate,
        outstandingFee: trackingForm.outstandingFee,
        status: trackingForm.status,
        senderName: trackingForm.senderName,
        senderEmail: trackingForm.senderEmail,
        senderPhone: trackingForm.senderPhone,
        senderAddress: trackingForm.senderAddress,
        receiverName: trackingForm.receiverName,
        receiverEmail: trackingForm.receiverEmail,
        receiverPhone: trackingForm.receiverPhone,
        receiverAddress: trackingForm.receiverAddress,
        packageDescription: trackingForm.packageDescription,
        carrierName: trackingForm.carrierName,
        carrierReference: trackingForm.carrierReference,
        quantity: trackingForm.quantity,
        paymentMode: trackingForm.paymentMode,
        shipmentMode: trackingForm.shipmentMode,
        deliveryTime: trackingForm.deliveryTime,
        trackingImage: trackingForm.trackingImage
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      setAdminMessage(err?.error || `Unable to update shipment (HTTP ${response.status})`);
      return;
    }

    const updated = await response.json();
    setShipments((current) => current.map((item) => (item.id === shipmentId ? updated : item)));
    setSelectedShipmentId(updated.id);
    setTrackedShipment(updated);
    setAdminView('dashboard');
    setEditingShipmentId('');
    setAdminMessage(`Shipment ${updated.id} updated.`);
  };

  const handleDeleteShipment = async (shipmentId: string) => {
    setAdminMessage('');
    if (!adminLoggedIn) return;

    const response = await fetch(`/api/admin/shipments?id=${encodeURIComponent(shipmentId)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const errorMessage = errorBody?.error || `Unable to remove shipment (HTTP ${response.status}).`;
      setAdminMessage(`${errorMessage}`);
      return;
    }

    setShipments((current) => {
      const filtered = current.filter((item) => item.id !== shipmentId);
      if (shipmentId === selectedShipmentId) {
        setSelectedShipmentId(filtered[0]?.id || '');
      }
      return filtered;
    });
    setAdminMessage('Shipment removed.');
  };

  const performTracking = async (eventOrQuery?: React.MouseEvent<HTMLButtonElement> | string) => {
    const rawQuery = typeof eventOrQuery === 'string' ? eventOrQuery : trackQuery;
    const searchQuery = rawQuery.trim();
    if (!searchQuery) {
      setTrackedShipment(null);
      setIsPackageImageOpen(false);
      navigate('/track');
      return;
    }
    const normalizedQuery = searchQuery.toLowerCase();

    try {
      const response = await fetch(`/api/public/shipments?id=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        setTrackedShipment(null);
        setIsPackageImageOpen(false);
        navigate('/track');
        return;
      }

      const payload = await response.json().catch(() => null);
      const latest = sanitizeShipments<Shipment>(Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : []);
      const found = latest.find((shipment) => shipment.id.toLowerCase() === normalizedQuery);

      if (found) {
        setTrackQuery(searchQuery);
        setShipments(latest);
        setSelectedShipmentId(found.id);
        setTrackedShipment(found);
        setIsPackageImageOpen(false);
        navigate(`/track?id=${encodeURIComponent(searchQuery)}`);
        return;
      }
    } catch {
      setTrackedShipment(null);
      setIsPackageImageOpen(false);
    }

    const fallback = shipments.find((shipment) => shipment.id.toLowerCase() === normalizedQuery);
    if (fallback) {
      setSelectedShipmentId(fallback.id);
      setTrackedShipment(fallback);
      setIsPackageImageOpen(false);
      navigate('/track');
      return;
    }

    setTrackedShipment(null);
    setIsPackageImageOpen(false);
    navigate('/track');
  };

  const handleViewDetails = (shipment: Shipment) => {
    setSelectedShipmentId(shipment.id);
    setAdminView('details');
    setAdminMessage(`Viewing shipment ${shipment.id}`);
  };

  const beginEditShipment = (shipment: Shipment) => {
    setEditingShipmentId(shipment.id);
    setGeneratedTrackingId(shipment.id);
    setTrackingForm({
      senderName: shipment.senderName || '',
      senderEmail: shipment.senderEmail || '',
      senderPhone: shipment.senderPhone || '',
      senderAddress: shipment.senderAddress || '',
      receiverName: shipment.receiverName || '',
      receiverEmail: shipment.receiverEmail || '',
      receiverPhone: shipment.receiverPhone || '',
      receiverAddress: shipment.receiverAddress || '',
      packageDescription: shipment.packageDescription || '',
      carrierName: shipment.carrierName || '',
      carrierReference: shipment.carrierReference || '',
      origin: shipment.origin,
      destination: shipment.destination,
      dispatchDate: shipment.dispatchDate || '',
      deliveryDate: shipment.deliveryDate || '',
      eta: shipment.eta,
      service: shipment.service,
      weight: shipment.weight,
      rate: shipment.rate,
      quantity: shipment.quantity || '',
      paymentMode: shipment.paymentMode || '',
      shipmentMode: shipment.shipmentMode || shipment.service,
      deliveryTime: shipment.deliveryTime || '',
      status: shipment.status,
      trackingImage: shipment.trackingImage || '',
      route: shipment.route ? JSON.stringify(shipment.route, null, 2) : JSON.stringify([[34.0522, -118.2437], [40.7128, -74.006]], null, 2),
      coords: shipment.coords ? JSON.stringify(shipment.coords) : JSON.stringify([34.0522, -118.2437]),
      outstandingFee: shipment.outstanding_fee || shipment.outstandingFee || defaultTrackingForm.outstandingFee || ''
    });
    setAdminView('add-tracking');
  };

  const cancelEdit = () => {
    setEditingShipmentId('');
    setTrackingForm(defaultTrackingForm);
    setGeneratedTrackingId('');
    setAdminView('dashboard');
  };

  const header = (
    <header className="site-header">
      <div className="brand-row">
        <div className="brand-mark">DGS</div>
        <div>
          <div className="brand-title">Direct Global Shipping</div>
          <div className="brand-subtitle">Strategic logistics for global trade teams.</div>
        </div>
      </div>
      <nav className="site-nav">
        <button type="button" onClick={() => navigate('/')}>Home</button>
        <button type="button" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>Services</button>
        <button type="button" onClick={() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })}>Live network</button>
        <button type="button" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>Contact</button>
      </nav>
      <button className="header-cta" type="button" onClick={() => navigate('/track')}>Track shipment</button>
    </header>
  );

  const homepage = (
    <div className="homepage-grid">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Enterprise logistics</span>
          <h1>Direct Global Shipping for modern freight operations.</h1>
          <p>From urgent air freight to ocean container and land transport, we make global shipping transparent, secure, and reliable.</p>
          <div className="hero-actions">
            <button className="cta-button" type="button" onClick={() => document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' })}>Track shipment</button>
            <button className="secondary-button" type="button" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>Get quote</button>
          </div>
          <div className="hero-action-grid">
            <div className="hero-action-card">
              <span className="hero-action-label">Q.</span>
              <strong>Track Shipment</strong>
              <p>Secure cargo visibility and status updates for every leg of transit.</p>
            </div>
            <div className="hero-action-card">
              <span className="hero-action-label">*</span>
              <strong>Get Quote</strong>
              <p>Instant pricing guidance for air, ocean, and land freight tailored to your route.</p>
            </div>
            <div className="hero-action-card">
              <span className="hero-action-label">24/7</span>
              <strong>Dedicated Support</strong>
              <p>Round-the-clock account managers and multilingual service for global teams.</p>
            </div>
          </div>
          <div className="hero-metrics">
            {stats.map((item) => (
              <div key={item.label} className="metric-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-feature-card">
            <span className="panel-label">Live logistics visibility</span>
            <h2>Real-time GPS tracking with predictive operational insight.</h2>
            <p>Monitor shipments 24/7, optimize lanes, and keep every delivery moving on schedule.</p>
            <div className="hero-feature-list">
              <div>• Live GPS tracking and route intelligence</div>
              <div>• Predictive alerts for high-value and time-sensitive freight</div>
              <div>• Secure chain-of-custody and tamper-proof cargo handling</div>
            </div>
          </div>
        </div>
      </section>

      <section className="track-section" id="track">
        <div className="section-heading">
          <span className="eyebrow">Live access</span>
          <h2>Track shipment or request an instant quote.</h2>
          <p>Access shipment status and quote guidance directly from the landing page.</p>
        </div>
        <div className="track-layout">
          <div className="track-card">
            <h3>Q. Track Shipment</h3>
            <p>Enter your booking reference to see live delivery status, ETA, and route updates.</p>
            <div className="track-form">
              <label>
                Tracking reference
                <input value={trackQuery} onChange={(e) => setTrackQuery(e.target.value)} placeholder="Enter booking reference" />
              </label>
              <button className="cta-button" type="button" onClick={() => performTracking()}>Track shipment</button>
            </div>
            {trackedShipment ? (
              <div className="track-result">
                <strong>{trackedShipment.id}</strong>
                <p>{trackedShipment.status} | {trackedShipment.service}</p>
                <p>{trackedShipment.origin} → {trackedShipment.destination}</p>
              </div>
            ) : (
              trackQuery && <p className="small-copy">No shipment found for that reference.</p>
            )}
          </div>
          <div className="quote-card">
            <h3>* Get Quote</h3>
            <p>Request a tailored quote for air, ocean, or land freight with transparent pricing and fast response.</p>
            <button className="secondary-button" type="button" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>Request a quote</button>
          </div>
        </div>
      </section>

      <section className="service-section" id="services">
        <div className="section-heading">
          <span className="eyebrow">Our services</span>
          <h2>Specialized freight modes built for global speed and scale.</h2>
        </div>
        <div className="service-grid">
          {serviceCards.map((card) => (
            <article
              key={card.title}
              className={`service-card ${selectedBackground === card.bgKey ? 'active' : ''}`}
              onClick={() => setSelectedBackground(card.bgKey)}
            >
              <div className="service-card-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <span className="eyebrow">Why choose us</span>
          <h2>Unmatched logistics excellence</h2>
          <p>Our commitment to innovation and customer satisfaction sets new standards in global logistics.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <h3>Real-Time GPS Tracking</h3>
            <p>Monitor your shipments 24/7 with live GPS tracking, predictive analytics, and dynamic status updates.</p>
          </article>
          <article className="feature-card">
            <h3>End-to-End Security</h3>
            <p>Advanced security protocols, tamper-proof seals, and comprehensive insurance for complete peace of mind.</p>
          </article>
          <article className="feature-card">
            <h3>24/7 Dedicated Support</h3>
            <p>Round-the-clock customer service with dedicated account managers and multi-language support.</p>
          </article>
        </div>
      </section>

      <section className="map-section" id="map">
        <div className="map-intro">
          <span className="eyebrow">Live network</span>
          <h2>Industry-grade shipment visibility for technical operations.</h2>
          <p>Global logistics teams trust our secure network overview to monitor performance, manage exceptions, and keep freight moving with precision.</p>
        </div>
        <div className="map-layout">
          <div className="confidence-panel">
            <div className="panel-title">Trusted network operations</div>
            <p>Enterprise-grade logistics engineered for accurate operational planning, secure execution, and audit-ready accountability.</p>
            <div className="confidence-grid">
              <div>
                <strong>Precision routing</strong>
                <span>Data-driven lane selection with optimized delivery windows.</span>
              </div>
              <div>
                <strong>Predictive ETA</strong>
                <span>Automated arrival forecasts and proactive exception alerts.</span>
              </div>
              <div>
                <strong>Security assurance</strong>
                <span>Encrypted tracking, tamper-proof seals, and insured custody.</span>
              </div>
            </div>
            {selectedShipment && (
              <div className="shipment-detail-card">
                <span className="panel-label">Operational intelligence</span>
                <h3>Route performance summary</h3>
                <p>{selectedShipment.origin} → {selectedShipment.destination}</p>
                <div className="shipment-detail-meta">
                  <span>{selectedShipment.service} · {selectedShipment.status}</span>
                  <span>ETA: {selectedShipment.eta}</span>
                  <span>Weight: {selectedShipment.weight}</span>
                </div>
              </div>
            )}
          </div>
          <div className="live-map">
            <div className="route-overlay-card">
              <div className="overlay-heading">
                <span>Network visibility</span>
                <h4>Global shipment coverage</h4>
              </div>
              <div className="overlay-grid">
                <div>
                  <span>Active shipments</span>
                  <strong>{shipments.length}</strong>
                </div>
                <div>
                  <span>Live regions</span>
                  <strong>{geofences.length}</strong>
                </div>
                <div>
                  <span>Map refresh</span>
                  <strong>Every 10s</strong>
                </div>
              </div>
            </div>
            <MapContainer bounds={mapBounds} boundsOptions={{ padding: [40, 40] }} scrollWheelZoom className="map-frame">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                {geofences.map((zone) => (
                  <Circle key={zone.label} center={zone.center} radius={zone.radius} pathOptions={{ color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 0.12 }} />
                ))}
              </MapContainer>
            </div>
          </div>
      </section>

      <section className="testimonial-section">
        <div className="section-heading">
          <span className="eyebrow">Customer feedback</span>
          <h2>Trusted by teams across North America.</h2>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="testimonial-card">
              <p>{testimonial.quote}</p>
              <div>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="section-heading">
          <span className="eyebrow">Contact us</span>
          <h2>Ready to scale your logistics operations?</h2>
        </div>
        <div className="contact-grid compact">
          <div className="contact-card contact-overview">
            <div className="contact-card-heading">Direct Global Shipping</div>
            <p>Enterprise freight management, customs facilitation, and supply chain visibility for global teams.</p>
          </div>
          <div className="contact-card contact-details">
            <div className="contact-card-heading">Get in touch</div>
            <p>Email: hello@directglobalshipping.com</p>
            <p>Phone: +1 (832) 555-0142</p>
          </div>
        </div>
      </section>
    </div>
  );

  const adminLogin = (
    <section className="admin-login-page">
      <div className="admin-login-card">
        <div className="section-heading">
          <span className="eyebrow">Admin access</span>
          <h2>Sign in to continue</h2>
          <p>Enter your credentials and proceed to the dashboard.</p>
        </div>
        <div className="form-grid admin-form">
          <label>
            Username
            <input value={credentials.user} onChange={(e) => setCredentials((prev) => ({ ...prev, user: e.target.value }))} placeholder="admin" />
          </label>
          <label>
            Password
            <input type="password" value={credentials.pass} onChange={(e) => setCredentials((prev) => ({ ...prev, pass: e.target.value }))} placeholder="••••••••" />
          </label>
          <button className="cta-button" type="button" onClick={handleLogin}>Sign in</button>
          {loginError && <p className="error-text">{loginError}</p>}
        </div>
      </div>
    </section>
  );

  const adminDashboard = (
    <div className="admin-dashboard-page">
      <div className="admin-header">
        <div className="admin-brand-row">
          <div className="brand-mark admin-mark">D</div>
          <div>
            <div className="brand-title">Direct Global Shipping</div>
            <div className="brand-subtitle">Admin dashboard</div>
          </div>
        </div>
        <nav className="admin-nav">
          {['dashboard', 'add-tracking', 'account', 'settings'].map((item) => (
            <button
              key={item}
              type="button"
              className={adminView === item ? 'active' : ''}
              onClick={() => {
                if (item === 'add-tracking') {
                  openAddTracking();
                  return;
                }
                setAdminView(item as typeof adminView);
              }}
            >
              {item === 'add-tracking' ? 'Add Tracking' : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="admin-user-row">
          <span>Admin</span>
          <div className="admin-avatar">A</div>
          <button className="secondary-button" type="button" onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      <section className="admin-summary-row">
        <div className="admin-summary-card">
          <span>Shipments</span>
          <strong>{shipments.length}</strong>
        </div>
        <div className="admin-summary-card">
          <span>Zones</span>
          <strong>{geofences.length}</strong>
        </div>
        <div className="admin-summary-card">
          <span>Current status</span>
          <strong>Live</strong>
        </div>
      </section>

      {adminView === 'dashboard' && selectedShipment && (
        <section className="admin-card detail-card">
          <div className="panel-title">Selected shipment details</div>
          <div className="detail-grid">
            <div>
              <strong>Tracking ID</strong>
              <p>{selectedShipment.id}</p>
            </div>
            <div>
              <strong>Status</strong>
              <p>{selectedShipment.status}</p>
            </div>
            <div>
              <strong>Route</strong>
              <p>{selectedShipment.origin} → {selectedShipment.destination}</p>
            </div>
            <div>
              <strong>ETA</strong>
              <p>{selectedShipment.eta}</p>
            </div>
            <div>
              <strong>Carrier</strong>
              <p>{selectedShipment.carrierName || 'N/A'}</p>
            </div>
            <div>
              <strong>Package</strong>
              <p>{selectedShipment.packageDescription || 'N/A'}</p>
            </div>
          </div>
        </section>
      )}

      {adminView === 'details' && selectedShipment && (
        <section className="admin-card detail-card">
          <div className="panel-title">Shipment details</div>
          <div className="detail-grid">
            <div>
              <strong>Tracking ID</strong>
              <p>{selectedShipment.id}</p>
            </div>
            <div>
              <strong>Status</strong>
              <p>{selectedShipment.status}</p>
            </div>
            <div>
              <strong>Route</strong>
              <p>{selectedShipment.origin} → {selectedShipment.destination}</p>
            </div>
            <div>
              <strong>ETA</strong>
              <p>{selectedShipment.eta}</p>
            </div>
            <div>
              <strong>Carrier</strong>
              <p>{selectedShipment.carrierName || 'N/A'}</p>
            </div>
            <div>
              <strong>Weight</strong>
              <p>{selectedShipment.weight}</p>
            </div>
            <div>
              <strong>Rate</strong>
              <p>{selectedShipment.rate}</p>
            </div>
            <div>
              <strong>Delivery time</strong>
              <p>{selectedShipment.deliveryTime || 'N/A'}</p>
            </div>
            <div>
              <strong>Sender</strong>
              <p>{selectedShipment.senderName || 'N/A'}</p>
            </div>
            <div>
              <strong>Receiver</strong>
              <p>{selectedShipment.receiverName || 'N/A'}</p>
            </div>
            <div>
              <strong>Package</strong>
              <p>{selectedShipment.packageDescription || 'N/A'}</p>
            </div>
            <div>
              <strong>Carrier ref</strong>
              <p>{selectedShipment.carrierReference || 'N/A'}</p>
            </div>
          </div>
          <div className="admin-form-actions">
            <button className="secondary-button" type="button" onClick={() => setAdminView('dashboard')}>
              Back to dashboard
            </button>
            <button className="cta-button" type="button" onClick={() => beginEditShipment(selectedShipment)}>
              Edit shipment
            </button>
          </div>
        </section>
      )}
      {adminView === 'dashboard' && (
        <section className="admin-card table-card">
          <div className="panel-title">Shipments</div>
          <div className="admin-table">
            <div className="table-row header-row">
              <div>Package</div>
              <div>Tracking number</div>
              <div>Status</div>
              <div>Date</div>
              <div>Actions</div>
            </div>
            {shipments.slice(0, 8).map((shipment) => (
              <div key={shipment.id} className={`table-row body-row ${shipment.id === selectedShipmentId ? 'selected' : ''}`}>
                <div className="package-cell" onClick={() => setSelectedShipmentId(shipment.id)}>
                  <div className="package-icon">{(shipment.service && shipment.service[0]) || '•'}</div>
                  <div>
                    <strong>{shipment.service}</strong>
                    <span>{shipment.origin} → {shipment.destination}</span>
                  </div>
                </div>
                <div>{shipment.id}</div>
                <div><span className={`status-badge ${shipment.status.toLowerCase().replace(/\s+/g, '-')}`}>{shipment.status}</span></div>
                <div>{shipment.eta}</div>
                <div className="action-group">
                  <button type="button" className="icon-button" title="View details" onClick={() => handleViewDetails(shipment)}>🔍</button>
                  <button type="button" className="icon-button" title="Edit" onClick={() => beginEditShipment(shipment)}>✏️</button>
                  <button type="button" className="icon-button" title="Delete" onClick={() => handleDeleteShipment(shipment.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {adminView === 'add-tracking' && (
        <section className="admin-card add-tracking-card">
          <div className="panel-title-row">
          <div>
            <div className="panel-title">{editingShipmentId ? 'Edit tracking entry' : 'Add tracking entry'}</div>
            <div className="tracking-id-banner">
              <span className="tracking-label">Tracking code</span>
              <div className="tracking-id-row">
                <span className="tracking-id">{generatedTrackingId || 'Generating...'}</span>
                <button type="button" className="secondary-button small" onClick={() => navigator.clipboard.writeText(generatedTrackingId || '').catch(() => null)}>
                  Copy
                </button>
              </div>
            </div>
          </div>
          <div />
        </div>
          <div className="admin-form-grid">
            <div className="form-section">
              <div className="panel-subtitle">Sender information</div>
              <div className="form-grid">
                <label>
                  Sender's name
                  <input value={trackingForm.senderName} onChange={(e) => setTrackingForm((prev) => ({ ...prev, senderName: e.target.value }))} />
                </label>
                <label>
                  Sender's phone
                  <input value={trackingForm.senderPhone} onChange={(e) => setTrackingForm((prev) => ({ ...prev, senderPhone: e.target.value }))} />
                </label>
                <label>
                  Sender's email
                  <input value={trackingForm.senderEmail} onChange={(e) => setTrackingForm((prev) => ({ ...prev, senderEmail: e.target.value }))} />
                </label>
                <label>
                  Sender's address
                  <textarea rows={3} value={trackingForm.senderAddress} onChange={(e) => setTrackingForm((prev) => ({ ...prev, senderAddress: e.target.value }))} />
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="panel-subtitle">Receiver information</div>
              <div className="form-grid">
                <label>
                  Receiver's name
                  <input value={trackingForm.receiverName} onChange={(e) => setTrackingForm((prev) => ({ ...prev, receiverName: e.target.value }))} />
                </label>
                <label>
                  Receiver's phone
                  <input value={trackingForm.receiverPhone} onChange={(e) => setTrackingForm((prev) => ({ ...prev, receiverPhone: e.target.value }))} />
                </label>
                <label>
                  Receiver's email
                  <input value={trackingForm.receiverEmail} onChange={(e) => setTrackingForm((prev) => ({ ...prev, receiverEmail: e.target.value }))} />
                </label>
                <label>
                  Receiver's address
                  <textarea rows={3} value={trackingForm.receiverAddress} onChange={(e) => setTrackingForm((prev) => ({ ...prev, receiverAddress: e.target.value }))} />
                </label>
              </div>
            </div>
          </div>

          <div className="admin-form-grid admin-form-secondary">
            <div className="form-section half-width">
              <div className="panel-subtitle">Package details</div>
              <div className="form-grid">
                <label>
                  Package description
                  <textarea rows={4} value={trackingForm.packageDescription} onChange={(e) => setTrackingForm((prev) => ({ ...prev, packageDescription: e.target.value }))} />
                </label>
                <label>
                  Carrier name
                  <input value={trackingForm.carrierName} onChange={(e) => setTrackingForm((prev) => ({ ...prev, carrierName: e.target.value }))} />
                </label>
                <label>
                  Carrier reference no.
                  <input value={trackingForm.carrierReference} onChange={(e) => setTrackingForm((prev) => ({ ...prev, carrierReference: e.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={trackingForm.status} onChange={(e) => setTrackingForm((prev) => ({ ...prev, status: e.target.value }))}>
                    <option>Pending confirmation</option>
                    <option>In transit</option>
                    <option>Customs clearance</option>
                    <option>Delivered</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="form-section half-width">
              <div className="panel-subtitle">Route & timing</div>
              <div className="form-grid">
                <label>
                  Origin port
                  <input value={trackingForm.origin} onChange={(e) => setTrackingForm((prev) => ({ ...prev, origin: e.target.value }))} />
                </label>
                <label>
                  Destination
                  <input value={trackingForm.destination} onChange={(e) => setTrackingForm((prev) => ({ ...prev, destination: e.target.value }))} />
                </label>
                <label>
                  Dispatch date
                  <input type="date" value={trackingForm.dispatchDate} onChange={(e) => setTrackingForm((prev) => ({ ...prev, dispatchDate: e.target.value }))} />
                </label>
                <label>
                  Delivery date
                  <input type="date" value={trackingForm.deliveryDate} onChange={(e) => setTrackingForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
                </label>
                <label>
                  ETA
                  <input type="date" value={trackingForm.eta} onChange={(e) => setTrackingForm((prev) => ({ ...prev, eta: e.target.value }))} />
                </label>
                <label>
                  Coords (JSON)
                  <input value={trackingForm.coords} onChange={(e) => setTrackingForm((prev) => ({ ...prev, coords: e.target.value }))} />
                </label>
                <label>
                  Weight
                  <input value={trackingForm.weight} onChange={(e) => setTrackingForm((prev) => ({ ...prev, weight: e.target.value }))} />
                </label>
                <label>
                  Quantity
                  <input value={trackingForm.quantity} onChange={(e) => setTrackingForm((prev) => ({ ...prev, quantity: e.target.value }))} />
                </label>
                <label>
                  Payment mode
                  <input value={trackingForm.paymentMode} onChange={(e) => setTrackingForm((prev) => ({ ...prev, paymentMode: e.target.value }))} />
                </label>
                <label>
                  Shipment mode
                  <input value={trackingForm.shipmentMode} onChange={(e) => setTrackingForm((prev) => ({ ...prev, shipmentMode: e.target.value }))} />
                </label>
                <label>
                  Delivery time
                  <input type="time" value={trackingForm.deliveryTime} onChange={(e) => setTrackingForm((prev) => ({ ...prev, deliveryTime: e.target.value }))} />
                </label>
                <label>
                  Rate
                  <input value={trackingForm.rate} onChange={(e) => setTrackingForm((prev) => ({ ...prev, rate: e.target.value }))} />
                </label>
                <label>
                  Outstanding fees
                  <input value={trackingForm.outstandingFee} onChange={(e) => setTrackingForm((prev) => ({ ...prev, outstandingFee: e.target.value }))} />
                </label>
              </div>
            </div>
          </div>

          <div className="upload-panel">
            <div className="panel-subtitle">Upload package image</div>
            <label className="upload-card">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setTrackingForm((prev) => ({ ...prev, trackingImage: '' }));
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setTrackingForm((prev) => ({ ...prev, trackingImage: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div>
                <strong>Upload package image</strong>
                <span>{trackingForm.trackingImage ? 'Image selected' : 'PNG, JPG, or GIF'}</span>
              </div>
            </label>
          </div>

          <div className="admin-form-actions">
            <button className="secondary-button" type="button" onClick={cancelEdit}>Cancel</button>
            <button className="cta-button" type="button" onClick={() => {
              if (editingShipmentId) {
                handleUpdateShipment(editingShipmentId);
              } else {
                handleCreateShipment();
              }
            }}>
              {editingShipmentId ? 'Update shipment' : 'Create shipment'}
            </button>
          </div>
        </section>
      )}

      {adminView === 'account' && (
        <section className="admin-card account-card">
          <div className="panel-title">Account</div>
          <div className="form-grid">
            <label>
              Admin name
              <input value="Admin User" disabled />
            </label>
            <label>
              Email
              <input value="admin@directglobalshipping.com" disabled />
            </label>
            <label>
              Role
              <input value="Administrator" disabled />
            </label>
            <label>
              Last login
              <input value="2026-07-28 09:12 AM" disabled />
            </label>
          </div>
        </section>
      )}

      {adminView === 'settings' && (
        <section className="admin-card settings-card">
          <div className="panel-title">Settings</div>
          <div className="form-grid">
            <label>
              Notifications
              <select>
                <option>Enabled</option>
                <option>Disabled</option>
              </select>
            </label>
            <label>
              Data refresh
              <select>
                <option>Every 5 minutes</option>
                <option>Every 15 minutes</option>
                <option>Every 30 minutes</option>
              </select>
            </label>
            <label>
              Theme
              <select>
                <option>Light</option>
                <option>Dark</option>
              </select>
            </label>
            <label>
              Support contact
              <input value="support@directglobalshipping.com" disabled />
            </label>
          </div>
        </section>
      )}

      {adminMessage && <div className="admin-notice">{adminMessage}</div>}
    </div>
  );

  const trackPage = (
    <div className="track-page">
      <section className="track-card">
        <div className="section-heading">
          <span className="eyebrow">Shipment tracking</span>
          <h2>Enter your tracking ID below to view shipment status.</h2>
          <p>Track a package instantly and get full details across origin, destination, sender, receiver, and package data.</p>
        </div>
        <div className="track-form">
          <label>
            Tracking ID
            <input value={trackQuery} onChange={(e) => setTrackQuery(e.target.value)} placeholder="DGS-100001" />
          </label>
          <div className="track-actions">
            <button className="cta-button" type="button" onClick={() => performTracking()}>Find shipment</button>
          </div>
        </div>
        {trackedShipment ? (
          <div className="track-result detailed-track-result">
            <div className="track-summary-row">
              <div>
                <span className="eyebrow">Shipment status</span>
                <h3>{trackedShipment.status}</h3>
                <p className="tracking-service">{trackedShipment.service} · {trackedShipment.origin} → {trackedShipment.destination}</p>
              </div>
              <div className="tracking-id-badge">
                <span>Tracking ID</span>
                <strong>{trackedShipment.id}</strong>
              </div>
            </div>

            <div className="tracking-detail-top">
              <div className="tracking-info-grid">
                <div className="tracking-info-card">
                  <div className="card-title">Sender information</div>
                  <p><strong>Name</strong><span>{trackedShipment.senderName || 'N/A'}</span></p>
                  <p><strong>Address</strong><span>{trackedShipment.senderAddress || 'N/A'}</span></p>
                  <p><strong>Phone</strong><span>{trackedShipment.senderPhone || 'N/A'}</span></p>
                  <p><strong>Email</strong><span>{trackedShipment.senderEmail || 'N/A'}</span></p>
                </div>
                <div className="tracking-info-card">
                  <div className="card-title">Receiver information</div>
                  <p><strong>Name</strong><span>{trackedShipment.receiverName || 'N/A'}</span></p>
                  <p><strong>Address</strong><span>{trackedShipment.receiverAddress || 'N/A'}</span></p>
                  <p><strong>Phone</strong><span>{trackedShipment.receiverPhone || 'N/A'}</span></p>
                  <p><strong>Email</strong><span>{trackedShipment.receiverEmail || 'N/A'}</span></p>
                </div>
                <div className="tracking-info-card package-card">
                  <div className="card-title">Package details</div>
                  <p><strong>Description</strong><span>{trackedShipment.packageDescription || 'N/A'}</span></p>
                  <p><strong>Weight</strong><span>{trackedShipment.weight}</span></p>
                  <p><strong>Quantity</strong><span>{trackedShipment.quantity || '1'}</span></p>
                  <p><strong>Status</strong><span>{trackedShipment.status}</span></p>
                </div>
                <div className="tracking-info-card tracking-image-card">
                  <div className="card-title">Shipment image</div>
                  <p className="image-card-copy">
                    {trackedShipment.trackingImage ? 'Tap to preview the uploaded shipment photo.' : 'No image uploaded yet for this shipment.'}
                  </p>
                  <button
                    className="cta-button small"
                    type="button"
                    onClick={() => setIsPackageImageOpen((open) => !open)}
                  >
                    {trackedShipment.trackingImage ? (isPackageImageOpen ? 'Hide shipment image' : 'View shipment image') : 'No image available'}
                  </button>
                  {isPackageImageOpen && trackedShipment.trackingImage && (
                    <div className="package-image-full">
                      <img src={trackedShipment.trackingImage} alt="Shipment item" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="tracking-detail-mid">
              <div className="status-panel">
                <div className="current-status-row">
                  <div>
                    <span className="eyebrow">Current status</span>
                    <h4>{trackedShipment.status}</h4>
                  </div>
                  <div className="status-chip">{trackedShipment.status}</div>
                </div>
                <div className="shipment-stats">
                  <div>
                    <span>Total weight</span>
                    <strong>{trackedShipment.weight}</strong>
                  </div>
                  <div>
                    <span>Carrier</span>
                    <strong>{trackedShipment.carrierName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>ETA</span>
                    <strong>{trackedShipment.eta}</strong>
                  </div>
                </div>
              </div>

              <div className="map-analytics-grid">
                <div className="map-card">
                  <div className="card-title">Live route map</div>
                  <div className="map-frame map-frame-overlay-wrapper" style={{ height: 360 }}>
                    <div className="route-overlay-card route-overlay-map">
                      <div className="overlay-heading">
                        <span>Live route summary</span>
                        <h4>{trackedShipment.origin} → {trackedShipment.destination}</h4>
                      </div>
                      <div className="overlay-grid overlay-grid-small">
                        <div>
                          <span>Current status</span>
                          <strong>{trackedShipment.status}</strong>
                        </div>
                        <div>
                          <span>Progress</span>
                          <strong>{trackedShipment.progress}%</strong>
                        </div>
                        <div>
                          <span>Last update</span>
                          <strong>{trackedShipment.eta}</strong>
                        </div>
                      </div>
                    </div>
                    <MapContainer key={trackedMapKey} bounds={trackedMapBounds} boundsOptions={{ padding: [40, 40] }} scrollWheelZoom className="map-frame-inner">
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                      {trackedRoute.length > 0 && (
                        <>
                          <Polyline pathOptions={{ color: '#fbbf24', weight: 8, opacity: 0.92, lineJoin: 'round' }} positions={smoothedTrackedRoute} />
                          {showTrackedWaypoints && smoothedTrackedRoute.length > 2 && smoothedTrackedRoute.slice(1, -1).map((p, wi) => (
                            <Marker key={`twp-${wi}`} position={p} icon={waypointIcon as any} />
                          ))}
                          <Marker position={trackedRoute[0]} icon={originIcon as any}>
                            <Popup>Origin</Popup>
                            <Tooltip permanent direction="top" offset={[0, -12]}>Origin</Tooltip>
                          </Marker>
                          <Marker position={trackedRoute[trackedRoute.length - 1]} icon={destinationIcon as any}>
                            <Popup>Destination</Popup>
                            <Tooltip permanent direction="top" offset={[0, -12]}>Destination</Tooltip>
                          </Marker>
                          {isCoordinatePair(trackedShipment?.coords) && (
                            <Marker position={trackedShipment.coords} icon={liveMarkerIcon as any}>
                              <Popup>Live position</Popup>
                            </Marker>
                          )}
                        </>
                      )}
                      {geofences.map((zone) => (
                        <Circle
                          key={zone.label}
                          center={zone.center}
                          radius={zone.radius}
                          pathOptions={{ color: '#2563eb', fillColor: '#bfdbfe', fillOpacity: 0.12, weight: 2, dashArray: '6 8' }}
                        >
                          <Popup>{zone.label}</Popup>
                        </Circle>
                      ))}
                    </MapContainer>
                  </div>
                    <div className="map-insight-strip">
                    <div>
                      <strong>Current hub</strong>
                      <span>{trackedShipment.origin}</span>
                    </div>
                    <div>
                      <strong>Next stop</strong>
                      <span>{trackedShipment.destination}</span>
                    </div>
                    <div>
                      <strong>Progress</strong>
                      {typeof trackedShipment.progress === 'number' && trackedShipment.progress > 0 ? (
                        <div className="progress-block">
                          <div className="progress-bar-outer" aria-hidden>
                            <div className="progress-bar-inner" style={{ width: `${trackedShipment.progress}%` }} />
                          </div>
                          <span>{trackedShipment.progress}%</span>
                        </div>
                      ) : (
                        <div className="progress-block fallback">
                          <div className="progress-status">
                            {getShipmentTimeline(trackedShipment.status).find((s) => s.state === 'current')?.label || trackedShipment.status}
                          </div>
                          <span className="muted">Status based on current shipment stage</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="analytics-stack">
                  <div className="route-analysis-card">
                    <div className="card-title">Route analytics</div>
                    <div className="analytics-row">
                      <div>
                        <span>Estimated arrival</span>
                        <strong>{trackedShipment.eta}</strong>
                      </div>
                      <div>
                        <span>Transit mode</span>
                        <strong>{trackedShipment.service}</strong>
                      </div>
                    </div>
                    <div className="analytics-row">
                      <div>
                        <span>Weight load</span>
                        <strong>{trackedShipment.weight}</strong>
                      </div>
                      <div>
                        <span>Route steps</span>
                        <strong>{trackedShipment.route.length}</strong>
                      </div>
                    </div>
                    <div className="analytics-status">
                      <span>Clearance status</span>
                      <strong>{trackedShipment.status.toLowerCase().includes('pending') ? 'Awaiting review' : 'On schedule'}</strong>
                    </div>
                  </div>

                  <div className="shipment-alert-card">
                    <div className="card-title">Shipment summary</div>
                    <div className="alert-row">
                      <span className="alert-label">Outstanding fees</span>
                      <strong>{trackedShipment.outstanding_fee || trackedShipment.outstandingFee || (trackedShipment.status.toLowerCase().includes('pending') ? '$1,380' : '$0')}</strong>
                    </div>
                    <p className="alert-copy">Check customs and payment status to avoid delays.</p>
                    <div className="alert-row compact">
                      <span>Item checks</span>
                      <strong>{trackedShipment.quantity || '1'} items</strong>
                    </div>
                    <div className="alert-row compact">
                      <span>Hold risk</span>
                      <strong>{trackedShipment.status.toLowerCase().includes('in transit') ? 'Low' : 'Moderate'}</strong>
                    </div>
                  </div>

                  <div className="timeline-panel">
                    <div className="card-title">Shipment history</div>
                    <div className="timeline-list">
                      {getShipmentTimeline(trackedShipment.status).map((step) => (
                        <div key={step.label} className={`timeline-step timeline-${step.state}`}>
                          <div className="timeline-marker" />
                          <div>
                            <strong>{step.label}</strong>
                            <p>{step.description}</p>
                          </div>
                          <span>{step.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="barcode-panel barcode-panel-bottom">
              <div className="barcode-copy">
                <span className="eyebrow">Tracking barcode</span>
                <p>Scan this barcode for quick reference.</p>
              </div>
              <div className="barcode-frame">
                {qrCodeDataUrl ? (
                  <a href={trackingUrl(trackedShipment.id)} target="_blank" rel="noreferrer">
                    <img src={qrCodeDataUrl} alt={`QR code for ${trackedShipment.id}`} className="tracking-qr" />
                  </a>
                ) : (
                  <div className="barcode-placeholder">QR code unavailable</div>
                )}
                <div className="barcode-label">{trackedShipment.id}</div>
              </div>
            </div>

            <div className="shipment-detail-meta detail-summary-row">
              <span>ETA: {trackedShipment.eta}</span>
              <span>Carrier: {trackedShipment.carrierName || 'N/A'}</span>
              <span>Rate: {trackedShipment.rate}</span>
            </div>
          </div>
        ) : (
          trackQuery && <p className="small-copy">No shipment found for that tracking ID.</p>
        )}
      </section>
    </div>
  );

  return (
    <div
      className="page-shell"
      style={{
        backgroundColor: '#eef2f7',
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.88), rgba(245, 247, 250, 0.88)), url(${backgroundImages[selectedBackground]})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {header}
      <main className="page-content">{isAdminRoute ? (adminLoggedIn ? adminDashboard : adminLogin) : isTrackRoute ? trackPage : homepage}</main>
    </div>
  );
}

export default App;
