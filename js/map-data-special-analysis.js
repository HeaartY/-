const GUANGDONG_GEOJSON_URL = './js/guangdong-440000.json';
const MAP_OFFSET_X = 0;
const MAP_OFFSET_Y = 0;

const CITY_INTENSITY = {
  广州市: 1,
  深圳市: 0.96,
  佛山市: 0.82,
  东莞市: 0.8,
  珠海市: 0.72,
  中山市: 0.68,
  惠州市: 0.7,
  江门市: 0.6,
  肇庆市: 0.56,
  清远市: 0.52,
  汕头市: 0.54,
  湛江市: 0.5,
};

const CORE_LINKS = [
  ['广州市', '佛山市', 0.86],
  ['广州市', '深圳市', 0.96],
  ['深圳市', '东莞市', 0.82],
  ['广州市', '惠州市', 0.68],
  ['广州市', '珠海市', 0.72],
  ['佛山市', '中山市', 0.58],
  ['湛江市', '茂名市', 0.42],
  ['清远市', '韶关市', 0.36],
];

const REGION_PALETTE = [
  ['#0f5aa6', '#0f5aa6', '#a7dbff'],
  ['#1368b5', '#1368b5', '#aee2ff'],
  ['#1775c4', '#1775c4', '#b7e6ff'],
  ['#1b82d0', '#1b82d0', '#c0ebff'],
  ['#2190d8', '#2190d8', '#c8efff'],
  ['#289fdd', '#289fdd', '#d0f3ff'],
  ['#31addf', '#31addf', '#d7f6ff'],
  ['#3db9df', '#3db9df', '#def8ff'],
  ['#49c4df', '#49c4df', '#e5fbff'],
  ['#56cfdf', '#56cfdf', '#ebfdff'],
];

const REGION_LABELS = {
  广州市: '广州',
  深圳市: '深圳',
  佛山市: '佛山',
  东莞市: '东莞',
  珠海市: '珠海',
  中山市: '中山',
  惠州市: '惠州',
  江门市: '江门',
  肇庆市: '肇庆',
  清远市: '清远',
  汕头市: '汕头',
  湛江市: '湛江',
  茂名市: '茂名',
  韶关市: '韶关',
  梅州市: '梅州',
  河源市: '河源',
  阳江市: '阳江',
  云浮市: '云浮',
  汕尾市: '汕尾',
  揭阳市: '揭阳',
  潮州市: '潮州',
};

function flattenCoordinates(coordinates, bucket = []) {
  for (const value of coordinates) {
    if (typeof value[0] === 'number') {
      bucket.push(value);
    } else {
      flattenCoordinates(value, bucket);
    }
  }
  return bucket;
}

function calculateBBox(features) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    const points = flattenCoordinates(feature.geometry.coordinates);
    for (const [lon, lat] of points) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return { minLon, maxLon, minLat, maxLat };
}

function projectPoint([lon, lat], bbox) {
  const width = bbox.maxLon - bbox.minLon || 1;
  const height = bbox.maxLat - bbox.minLat || 1;
  const normalizedX = (lon - bbox.minLon) / width;
  const normalizedY = (lat - bbox.minLat) / height;

  return [normalizedX * 9.6 - 4.8 + MAP_OFFSET_X, (1 - normalizedY) * 14.4 - 7.2 + MAP_OFFSET_Y];
}

function getLargestRing(rings) {
  let best = rings[0] ?? [];
  let maxScore = -Infinity;

  for (const ring of rings) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const score = (maxX - minX) * (maxY - minY);
    if (score > maxScore) {
      maxScore = score;
      best = ring;
    }
  }

  return best;
}

function geometryToShapes(geometry, bbox) {
  if (!geometry) return [];

  if (geometry.type === 'Polygon') {
    const ring = getLargestRing(geometry.coordinates);
    return [ring.map((point) => projectPoint(point, bbox))];
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => getLargestRing(polygon))
      .filter((ring) => ring.length > 2)
      .map((ring) => ring.map((point) => projectPoint(point, bbox)));
  }

  return [];
}

function fallbackCenter(shapes) {
  let weightedX = 0;
  let weightedY = 0;
  let totalArea = 0;

  for (const points of shapes) {
    let signedAreaTwice = 0;
    let centroidXTimesArea = 0;
    let centroidYTimesArea = 0;

    for (let index = 0; index < points.length; index += 1) {
      const [x1, y1] = points[index];
      const [x2, y2] = points[(index + 1) % points.length];
      const cross = x1 * y2 - x2 * y1;
      signedAreaTwice += cross;
      centroidXTimesArea += (x1 + x2) * cross;
      centroidYTimesArea += (y1 + y2) * cross;
    }

    const signedArea = signedAreaTwice / 2;
    const area = Math.abs(signedArea);
    if (area < 1e-6) continue;

    weightedX += (centroidXTimesArea / (6 * signedArea)) * area;
    weightedY += (centroidYTimesArea / (6 * signedArea)) * area;
    totalArea += area;
  }

  if (totalArea > 0) {
    return {
      x: weightedX / totalArea,
      y: weightedY / totalArea,
    };
  }

  const points = shapes.flat();
  const sum = points.reduce(
    (accumulator, [x, y]) => {
      accumulator.x += x;
      accumulator.y += y;
      return accumulator;
    },
    { x: 0, y: 0 }
  );

  return {
    x: points.length ? sum.x / points.length : 0,
    y: points.length ? sum.y / points.length : 0,
  };
}

function createHotspots(regions, bbox) {
  return regions.map((region) => {
    const intensity = CITY_INTENSITY[region.name] ?? 0.44;
    const cp = Array.isArray(region.cp) ? projectPoint(region.cp, bbox) : null;
    const center = cp ? { x: cp[0], y: cp[1] } : fallbackCenter(region.shapes);

    return {
      id: region.id,
      name: region.name,
      x: center.x,
      y: center.y,
      value: intensity,
      radius: 0.28 + intensity * 0.28,
      color: intensity > 0.84 ? '#ff7a18' : intensity > 0.64 ? '#ff9a4c' : '#ffd57f',
    };
  });
}

function createLinks(hotspots) {
  const byName = Object.fromEntries(hotspots.map((item) => [item.name, item]));

  return CORE_LINKS.map(([fromName, toName, strength]) => {
    const from = byName[fromName];
    const to = byName[toName];
    if (!from || !to) return null;
    return { from: from.id, to: to.id, strength };
  }).filter(Boolean);
}

function getRegionPalette(index) {
  const [fillStart, fillEnd, outline] = REGION_PALETTE[index % REGION_PALETTE.length];
  return { fillStart, fillEnd, outline };
}

export async function loadGuangdongMapData() {
  const response = await fetch(GUANGDONG_GEOJSON_URL);
  if (!response.ok) {
    throw new Error(`Failed to load Guangdong GeoJSON: ${response.status}`);
  }

  const data = await response.json();
  const features = data?.features ?? [];
  const bbox = calculateBBox(features);

  const regions = features
    .map((feature, index) => {
      const properties = feature.properties ?? {};
      const id = String(properties.id ?? properties.adcode ?? index + 1);
      const name = properties.name ?? properties.fullname ?? `region-${index + 1}`;
      const shapes = geometryToShapes(feature.geometry, bbox);
      const intensity = CITY_INTENSITY[name] ?? 0.42;
      if (!shapes.length) return null;

      const palette = getRegionPalette(index);
      const center = fallbackCenter(shapes);

      return {
        id,
        name,
        shortName: REGION_LABELS[name] ?? name.replace(/市$/, ''),
        cp: properties.cp,
        center,
        elevation: 0,
        glowStrength: 0,
        heatLevel: intensity,
        fillStart: palette.fillStart,
        fillEnd: palette.fillEnd,
        outline: palette.outline,
        shapes,
      };
    })
    .filter(Boolean);

  const hotspots = createHotspots(regions, bbox);
  const links = createLinks(hotspots);

  return { regions, hotspots, links };
}

export async function loadCityMapData(adcode) {
  const url = `./geo/${adcode}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load city GeoJSON: ${response.status}`);
  }

  const data = await response.json();
  const features = data?.features ?? [];
  const cityBbox = calculateBBox(features);

  // 用地市自身的 bbox 投影，让地图居中于 (0,0)
  const width = cityBbox.maxLon - cityBbox.minLon || 1;
  const height = cityBbox.maxLat - cityBbox.minLat || 1;
  function cityProjectPoint(lon, lat) {
    const normalizedX = (lon - cityBbox.minLon) / width;
    const normalizedY = (lat - cityBbox.minLat) / height;
    return [normalizedX * 9.6 - 4.8, (1 - normalizedY) * 14.4 - 7.2];
  }

  function cityGeometryToShapes(geometry) {
    if (geometry.type === 'Polygon') {
      const ring = getLargestRing(geometry.coordinates);
      if (ring.length < 3) return [];
      return [[...ring.map((p) => cityProjectPoint(p[0], p[1]))]];
    }
    if (geometry.type === 'MultiPolygon') {
      const shapes = [];
      for (const polygon of geometry.coordinates) {
        const ring = getLargestRing(polygon);
        if (ring.length > 2) shapes.push([...ring.map((p) => cityProjectPoint(p[0], p[1]))]);
      }
      return shapes;
    }
    return [];
  }

  const regions = features
    .map((feature, index) => {
      const properties = feature.properties ?? {};
      const id = String(properties.adcode ?? properties.id ?? index + 1);
      const name = properties.name ?? properties.fullname ?? `district-${index + 1}`;
      const shapes = cityGeometryToShapes(feature.geometry);
      if (!shapes.length) return null;

      const palette = getRegionPalette(index);
      const center = fallbackCenter(shapes);

      return {
        id,
        name,
        shortName: name.replace(/区$|县$|市$/, ''),
        cp: properties.center ?? properties.cp,
        center,
        elevation: 0,
        glowStrength: 0,
        heatLevel: 0.5,
        fillStart: palette.fillStart,
        fillEnd: palette.fillEnd,
        outline: palette.outline,
        shapes,
      };
    })
    .filter(Boolean);

  const hotspots = createHotspots(regions, cityBbox);

  return { regions, hotspots, links: [] };
}
