export const seededShipments = [
  {
    id: 'DGS-100001',
    status: 'In transit',
    origin: 'Los Angeles, CA',
    destination: 'New York, NY',
    eta: '2026-09-24',
    service: 'Air Freight',
    weight: '2,200 KG',
    rate: '$18,500',
    progress: 72,
    coords: [34.0522, -118.2437],
    route: [
      [34.0522, -118.2437],
      [37.3382, -121.8863],
      [40.7128, -74.006],
      [40.7128, -74.006]
    ],
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
    quantity: '120',
    paymentMode: 'Prepaid',
    shipmentMode: 'Air Freight',
    dispatchDate: '2026-09-18',
    deliveryDate: '2026-09-24',
    deliveryTime: '08:00',
    trackingImage: ''
  },
  {
    id: 'DGS-100002',
    status: 'Pending confirmation',
    origin: 'Houston, TX',
    destination: 'Chicago, IL',
    eta: '2026-09-29',
    service: 'Land Transport',
    weight: '1,100 KG',
    rate: '$8,900',
    progress: 24,
    coords: [29.7604, -95.3698],
    route: [
      [29.7604, -95.3698],
      [41.8781, -87.6298]
    ],
    senderName: 'Ariana Smith',
    senderEmail: 'arianas@globalmail.com',
    senderPhone: '08000000001',
    senderAddress: 'North Harbor Way 16',
    receiverName: 'Robert Dean',
    receiverEmail: 'robertdean@westmail.com',
    receiverPhone: '07000000001',
    receiverAddress: 'Unit 2, Lakeshore Plaza',
    packageDescription: 'Industrial spare parts',
    carrierName: 'FedEx',
    carrierReference: 'FX-334800',
    quantity: '48',
    paymentMode: 'Collect',
    shipmentMode: 'Land Transport',
    dispatchDate: '2026-09-20',
    deliveryDate: '2026-09-29',
    deliveryTime: '16:30',
    trackingImage: ''
  }
];

export const seededGeofences = [
  {
    label: 'East Coast Hub',
    center: [40.7128, -74.006],
    radius: 18000
  },
  {
    label: 'West Coast Gate',
    center: [34.0522, -118.2437],
    radius: 22000
  }
];
