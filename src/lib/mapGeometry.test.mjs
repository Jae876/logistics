import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeShipments, sanitizeGeofences } from './mapGeometry.js';

test('sanitizeShipments removes invalid route points and keeps valid coordinates', () => {
  const result = sanitizeShipments([
    {
      id: 'SHIP-1',
      coords: [40.7128, -74.006],
      route: [[40.7128, -74.006], [null, -73], [41.0, -73.0]]
    }
  ]);

  assert.deepEqual(result[0].coords, [40.7128, -74.006]);
  assert.deepEqual(result[0].route, [[40.7128, -74.006], [41.0, -73.0]]);
});

test('sanitizeGeofences falls back to a safe center when data is invalid', () => {
  const result = sanitizeGeofences([{ label: 'Test', center: [null, undefined], radius: 1000 }]);

  assert.equal(result[0].center[0], 34.0522);
  assert.equal(result[0].center[1], -118.2437);
});
