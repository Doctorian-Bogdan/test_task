import { clamp, randomFloat, randomInt } from './utils';

const EPSILON = 1e-9;

export function polygonBounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function translatePolygon(points, dx, dy) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

export function keepPolygonInside(points, width, height, padding = 6) {
  const bounds = polygonBounds(points);
  let dx = 0;
  let dy = 0;

  if (bounds.minX < padding) dx = padding - bounds.minX;
  if (bounds.maxX > width - padding) dx = (width - padding) - bounds.maxX;
  if (bounds.minY < padding) dy = padding - bounds.minY;
  if (bounds.maxY > height - padding) dy = (height - padding) - bounds.maxY;

  return translatePolygon(points, dx, dy);
}

export function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || EPSILON) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + EPSILON && b.x + EPSILON >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) + EPSILON && b.y + EPSILON >= Math.min(a.y, c.y);
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

export function polygonsOverlap(pointsA, pointsB) {
  for (let i = 0; i < pointsA.length; i += 1) {
    const a1 = pointsA[i];
    const a2 = pointsA[(i + 1) % pointsA.length];
    for (let j = 0; j < pointsB.length; j += 1) {
      const b1 = pointsB[j];
      const b2 = pointsB[(j + 1) % pointsB.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  if (pointInPolygon(pointsA[0], pointsB)) return true;
  if (pointInPolygon(pointsB[0], pointsA)) return true;
  return false;
}

export function polygonsSelfIntersect(points) {
  for (let i = 0; i < points.length; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j += 1) {
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      const adjacent = i === j || (i + 1) % points.length === j || i === (j + 1) % points.length;
      if (adjacent) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export function createRandomPolygon(width, height, existingPolygons) {
  const padding = 28;
  const tries = 300;

  for (let attempt = 0; attempt < tries; attempt += 1) {
    const vertices = randomInt(3, 7);
    const cx = randomFloat(70, Math.max(70, width - 70));
    const cy = randomFloat(70, Math.max(70, height - 70));
    const baseRadius = randomFloat(26, 58);

    const points = [];
    let angle = randomFloat(0, Math.PI * 2);
    const dentIndex = Math.random() < 0.55 ? randomInt(0, vertices - 1) : -1;

    for (let i = 0; i < vertices; i += 1) {
      angle += randomFloat(0.55, 1.35);
      const isDent = i === dentIndex && vertices > 3;
      const radius = baseRadius * (isDent ? randomFloat(0.35, 0.6) : randomFloat(0.72, 1.18));
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }

    const normalized = keepPolygonInside(points, width, height, padding);
    const bounds = polygonBounds(normalized);
    if (bounds.minX < padding || bounds.minY < padding || bounds.maxX > width - padding || bounds.maxY > height - padding) {
      continue;
    }
    if (polygonsSelfIntersect(normalized)) continue;
    const overlap = existingPolygons.some((polygon) => polygonsOverlap(normalized, polygon.points));
    if (overlap) continue;
    return normalized;
  }

  return null;
}

export function findSafeTranslation(nextPoints, originalPoints, others, width, height) {
  const originalCenter = polygonCentroid(originalPoints);
  const targetCenter = polygonCentroid(nextPoints);
  const deltaX = targetCenter.x - originalCenter.x;
  const deltaY = targetCenter.y - originalCenter.y;

  let best = originalPoints;
  const steps = 18;

  for (let i = 1; i <= steps; i += 1) {
    const ratio = i / steps;
    let candidate = translatePolygon(originalPoints, deltaX * ratio, deltaY * ratio);
    candidate = keepPolygonInside(candidate, width, height, 6);
    const blocked = others.some((polygon) => polygonsOverlap(candidate, polygon.points));
    if (blocked) break;
    best = candidate;
  }

  return best;
}

export function getContrastStroke(fill) {
  const matched = fill.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/i);
  if (!matched) return '#111827';
  const [, h, s, l] = matched.map(Number);
  const nextLight = clamp(l > 55 ? l - 24 : l + 28, 12, 92);
  return `hsl(${h} ${Math.max(25, s)}% ${nextLight}%)`;
}
