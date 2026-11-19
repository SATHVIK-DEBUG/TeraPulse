import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { GeographicalCell, Region } from './types.ts';

/**
 * Subdivides any GeoJSON Polygon region into regular spatial monitoring cells using Turf.js.
 * Grid cell size adapts dynamically to region area so small districts and larger corridors
 * remain inspectable (~12 to 36 cells) without cluttering the Leaflet canvas.
 */
export function generateRegionGridCells(
  regionId: string,
  boundary: Feature<Polygon>
): GeographicalCell[] {
  const bbox = turf.bbox(boundary) as [number, number, number, number];
  const areaKm2 = turf.area(boundary) / 1_000_000;

  // Choose grid step in kilometers targeting ~16-30 cells
  const rawSideKm = Math.sqrt(Math.max(areaKm2, 16) / 20);
  const cellSideKm = Math.max(1.5, Math.min(25, Number(rawSideKm.toFixed(1))));

  const grid = turf.squareGrid(bbox, cellSideKm, { units: 'kilometers' });
  const cells: GeographicalCell[] = [];

  // Keep cells whose centroid or polygon intersects the region boundary
  let index = 0;
  const colsSet = new Set<number>();
  const rowsSet = new Set<number>();

  const intersecting = grid.features.filter((cell) => {
    const center = turf.centroid(cell);
    return turf.booleanPointInPolygon(center, boundary) || turf.booleanIntersects(cell, boundary);
  });

  // Sort top-to-bottom (north to south), left-to-right (west to east) for intuitive row/col IDs
  const withCentroids = intersecting.map((cell) => {
    const c = turf.centroid(cell).geometry.coordinates; // [lng, lat]
    return { cell, lng: c[0], lat: c[1] };
  });

  withCentroids.sort((a, b) => {
    const latDiff = Math.round((b.lat - a.lat) * 1000);
    if (Math.abs(latDiff) > 5) return latDiff;
    return a.lng - b.lng;
  });

  // Cap at 49 cells for clean interactive map performance
  const capped = withCentroids.slice(0, 49);
  const colsPerRow = Math.max(1, Math.round(Math.sqrt(capped.length)));

  for (const item of capped) {
    const row = Math.floor(index / colsPerRow) + 1;
    const col = (index % colsPerRow) + 1;
    rowsSet.add(row);
    colsSet.add(col);
    const cellArea = Number((turf.area(item.cell) / 1_000_000).toFixed(2));
    const cellId = `${regionId}-R${row}C${col}`;

    cells.push({
      id: cellId,
      regionId,
      label: `Cell R${row}·C${col}`,
      row,
      col,
      centroid: [Number(item.lat.toFixed(4)), Number(item.lng.toFixed(4))],
      areaKm2: cellArea,
      geometry: item.cell,
    });
    index += 1;
  }

  return cells;
}

/**
 * Builds a complete TerraPulse Region entity from a validated GeoJSON Polygon feature.
 */
export function buildRegionFromPolygon(params: {
  id: string;
  name: string;
  district: string;
  state: string;
  country: string;
  description: string;
  origin: 'pilot' | 'comparison' | 'custom';
  polygon: Feature<Polygon>;
  createdAt?: string;
}): Region {
  const bbox = turf.bbox(params.polygon) as [number, number, number, number];
  const centerCoord = turf.centroid(params.polygon).geometry.coordinates; // [lng, lat]
  const areaKm2 = Number((turf.area(params.polygon) / 1_000_000).toFixed(2));
  const cells = generateRegionGridCells(params.id, params.polygon);

  return {
    id: params.id,
    name: params.name,
    district: params.district,
    state: params.state,
    country: params.country,
    description: params.description,
    origin: params.origin,
    center: [Number(centerCoord[1].toFixed(4)), Number(centerCoord[0].toFixed(4))],
    bbox: [
      Number(bbox[0].toFixed(4)),
      Number(bbox[1].toFixed(4)),
      Number(bbox[2].toFixed(4)),
      Number(bbox[3].toFixed(4)),
    ],
    areaKm2,
    boundary: params.polygon,
    cells,
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Builds a rectangular GeoJSON polygon from South, West, North, East decimal degrees.
 */
export function buildRegionFromBBox(params: {
  id: string;
  name: string;
  district: string;
  state: string;
  country: string;
  description: string;
  origin: 'pilot' | 'comparison' | 'custom';
  south: number;
  west: number;
  north: number;
  east: number;
}): Region {
  const polygon = turf.bboxPolygon([params.west, params.south, params.east, params.north]);
  return buildRegionFromPolygon({
    ...params,
    polygon,
  });
}

/**
 * Pre-configured Andhra Pradesh pilot & comparison regions.
 * Coordinates verified:
 *   Puttur:   13.4419° N, 79.5531° E (Default Pilot)
 *   Tirupati: 13.6288° N, 79.4192° E
 *   Chittoor: 13.2160° N, 79.0980° E
 */
export function createInitialPilotRegions(): Region[] {
  const putturPoly = turf.polygon([
    [
      [79.465, 13.365],
      [79.645, 13.365],
      [79.655, 13.445],
      [79.635, 13.520],
      [79.475, 13.520],
      [79.455, 13.440],
      [79.465, 13.365],
    ],
  ]);

  const tirupatiPoly = turf.polygon([
    [
      [79.325, 13.550],
      [79.515, 13.550],
      [79.520, 13.645],
      [79.495, 13.715],
      [79.340, 13.715],
      [79.315, 13.635],
      [79.325, 13.550],
    ],
  ]);

  const chittoorPoly = turf.polygon([
    [
      [79.005, 13.135],
      [79.190, 13.135],
      [79.200, 13.225],
      [79.180, 13.300],
      [79.020, 13.300],
      [78.995, 13.215],
      [79.005, 13.135],
    ],
  ]);

  return [
    buildRegionFromPolygon({
      id: 'puttur-ap',
      name: 'Puttur Pilot Basin',
      district: 'Tirupati District',
      state: 'Andhra Pradesh',
      country: 'India',
      description:
        'Primary TerraPulse pilot region covering Puttur town, surrounding irrigated croplands, and the Nagari foothills corridor.',
      origin: 'pilot',
      polygon: putturPoly,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    buildRegionFromPolygon({
      id: 'tirupati-ap',
      name: 'Tirupati Foothills',
      district: 'Tirupati District',
      state: 'Andhra Pradesh',
      country: 'India',
      description:
        'Comparison zone spanning Tirupati urban basin and the Seshachalam hill range forest transition.',
      origin: 'comparison',
      polygon: tirupatiPoly,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    buildRegionFromPolygon({
      id: 'chittoor-ap',
      name: 'Chittoor Agricultural Belt',
      district: 'Chittoor District',
      state: 'Andhra Pradesh',
      country: 'India',
      description:
        'Comparison dryland agricultural zone characterized by mango orchards, groundnut cultivation, and seasonal rainfall sensitivity.',
      origin: 'comparison',
      polygon: chittoorPoly,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  ];
}
