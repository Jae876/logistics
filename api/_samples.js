export const SAMPLE_SHIPMENTS = [
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

export const SAMPLE_GEOFENCES = [
  { label: 'East Coast Hub', center: [40.7128, -74.0060], radius: 18000 },
  { label: 'Atlantic Corridor', center: [43.0000, -60.0000], radius: 280000 }
];
