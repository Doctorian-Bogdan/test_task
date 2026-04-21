export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function randomColor() {
  const hue = randomInt(0, 359);
  const sat = randomInt(65, 85);
  const light = randomInt(50, 62);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function deepCloneState(state) {
  return {
    polygons: state.polygons.map((polygon) => ({
      ...polygon,
      points: polygon.points.map((p) => ({ ...p })),
    })),
    selectedId: state.selectedId,
  };
}

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}