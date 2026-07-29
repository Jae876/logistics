export type Coordinate = [number, number];

export interface ShipmentLike {
  coords?: unknown;
  route?: unknown;
  id?: string;
  [key: string]: unknown;
}

export interface GeofenceLike {
  center?: unknown;
  radius?: unknown;
  label?: string;
  [key: string]: unknown;
}

export function sanitizeCoordinatePair(value: unknown): Coordinate;
export function sanitizeShipments<T extends ShipmentLike>(shipments: T[] | null | undefined): Array<T & { coords: Coordinate; route: Coordinate[] }>;
export function sanitizeGeofences<T extends GeofenceLike>(geofences: T[] | null | undefined): Array<T & { center: Coordinate; radius: number }>;
