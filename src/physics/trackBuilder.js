/**
 * Track Builder — Defines track geometry as a series of connected segments.
 * Each segment is one of: 'ramp', 'flat', 'loop', 'rampUp'.
 * 
 * The track is represented as a polyline of (x, y) points with metadata
 * at each point (angle, curvature, segment type).
 * 
 * Smooth transitions use cubic Hermite interpolation to match tangents
 * at segment junctions, preventing bouncing or velocity deviation.
 */

const POINTS_PER_UNIT = 8; // resolution: 8 points per meter of track

/**
 * Generate points for a ramp segment going downhill.
 * @param {number} length - ramp length in meters
 * @param {number} angleDeg - angle in degrees
 * @param {number} startX - starting x coordinate
 * @param {number} startY - starting y coordinate
 */
function rampDownPoints(length, angleDeg, startX, startY) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const n = Math.max(2, Math.round(length * POINTS_PER_UNIT));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const d = t * length;
    points.push({
      x: startX + d * Math.cos(angleRad),
      y: startY - d * Math.sin(angleRad),
      dist: d,
      angle: -angleRad,
      type: 'ramp',
      curvature: 0,
    });
  }
  return points;
}

/**
 * Generate points for a flat segment.
 */
function flatPoints(length, startX, startY) {
  const n = Math.max(2, Math.round(length * POINTS_PER_UNIT));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const d = t * length;
    points.push({
      x: startX + d,
      y: startY,
      dist: d,
      angle: 0,
      type: 'flat',
      curvature: 0,
    });
  }
  return points;
}

/**
 * Generate points for a circular loop (full 360°).
 * The loop starts at the bottom, goes up the right side, over the top, down the left, back to bottom.
 * @param {number} radius - loop radius in meters
 * @param {number} startX - x where loop begins (bottom of the circle)
 * @param {number} startY - y where loop begins
 */
function loopPoints(radius, startX, startY) {
  // Center of the loop is directly above the start point
  const cx = startX;
  const cy = startY + radius;
  const circumference = 2 * Math.PI * radius;
  const n = Math.max(16, Math.round(circumference * POINTS_PER_UNIT));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Start at bottom (angle = -π/2), go clockwise
    const theta = -Math.PI / 2 + t * 2 * Math.PI;
    points.push({
      x: cx + radius * Math.cos(theta),
      y: cy + radius * Math.sin(theta),
      dist: t * circumference,
      // Tangent angle: perpendicular to radius, in direction of travel
      angle: theta + Math.PI / 2,
      type: 'loop',
      curvature: 1 / radius,
      loopAngle: t * 360, // degrees around the loop
    });
  }
  return points;
}

/**
 * Generate points for a ramp going uphill.
 */
function rampUpPoints(length, angleDeg, startX, startY) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const n = Math.max(2, Math.round(length * POINTS_PER_UNIT));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const d = t * length;
    points.push({
      x: startX + d * Math.cos(angleRad),
      y: startY + d * Math.sin(angleRad),
      dist: d,
      angle: angleRad,
      type: 'rampUp',
      curvature: 0,
    });
  }
  return points;
}

/**
 * Cubic Hermite interpolation between two points with tangent matching.
 * Used to create smooth transitions between track segments.
 */
function hermiteInterp(p0, p1, t0, t1, numPoints) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    points.push({
      x: h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
      y: h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
      type: 'transition',
      curvature: 0,
    });
  }
  return points;
}

/**
 * Build the full track from segment definitions.
 * Each segment: { type: 'ramp'|'flat'|'loop'|'rampUp', ...params }
 * 
 * @param {Array} segments - array of segment definitions
 * @param {number} rampThickness - visual thickness of the ramp surface (meters)
 * @returns {{ points: Array, totalLength: number, segments: Array, rampThickness: number }}
 */
export function buildTrack(segments, rampThickness = 0.3) {
  if (!segments || segments.length === 0) {
    // Default: simple ramp
    segments = [{ type: 'ramp', length: 15, angleDeg: 30 }];
  }

  let allPoints = [];
  let curX = 0;
  let curY = 0;
  const segmentRanges = [];

  // First pass: compute starting height for the first ramp
  // so the track starts elevated
  let totalHeight = 0;
  for (const seg of segments) {
    if (seg.type === 'ramp') {
      totalHeight += seg.length * Math.sin((seg.angleDeg * Math.PI) / 180);
    } else if (seg.type === 'rampUp') {
      totalHeight -= seg.length * Math.sin((seg.angleDeg * Math.PI) / 180);
    }
  }
  curY = Math.max(0, totalHeight);

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    let segPoints = [];
    const startIdx = allPoints.length;

    switch (seg.type) {
      case 'ramp':
        segPoints = rampDownPoints(seg.length || 10, seg.angleDeg || 30, curX, curY);
        break;
      case 'flat':
        segPoints = flatPoints(seg.length || 5, curX, curY);
        break;
      case 'loop':
        segPoints = loopPoints(seg.radius || 3, curX, curY);
        break;
      case 'rampUp':
        segPoints = rampUpPoints(seg.length || 5, seg.angleDeg || 15, curX, curY);
        break;
      default:
        continue;
    }

    if (segPoints.length > 0) {
      // If not first segment, add smooth transition
      if (allPoints.length > 0 && s > 0) {
        const lastPt = allPoints[allPoints.length - 1];
        const firstPt = segPoints[0];

        // Calculate tangent vectors from the angles
        const prevAngle = lastPt.angle || 0;
        const nextAngle = firstPt.angle || 0;

        // Only add transition if there's an angle mismatch
        const angleDiff = Math.abs(prevAngle - nextAngle);
        if (angleDiff > 0.01) {
          const transitionLen = Math.max(0.5, angleDiff * 2);
          const t0 = { x: transitionLen * Math.cos(prevAngle), y: transitionLen * Math.sin(prevAngle) };
          const t1 = { x: transitionLen * Math.cos(nextAngle), y: transitionLen * Math.sin(nextAngle) };
          const transPoints = hermiteInterp(lastPt, firstPt, t0, t1, 12);
          // Skip first and last to avoid duplicates
          for (let i = 1; i < transPoints.length - 1; i++) {
            allPoints.push(transPoints[i]);
          }
        }
      }

      // Add segment points (skip first if it duplicates last)
      for (let i = (allPoints.length > 0 && s > 0) ? 1 : 0; i < segPoints.length; i++) {
        allPoints.push(segPoints[i]);
      }

      // Update cursor to end of segment
      const lastSegPt = segPoints[segPoints.length - 1];
      curX = lastSegPt.x;
      curY = lastSegPt.y;

      segmentRanges.push({
        type: seg.type,
        startIdx,
        endIdx: allPoints.length - 1,
        params: seg,
      });
    }
  }

  // Compute cumulative distance along the track
  let cumulDist = 0;
  for (let i = 0; i < allPoints.length; i++) {
    if (i === 0) {
      allPoints[i].cumDist = 0;
    } else {
      const dx = allPoints[i].x - allPoints[i - 1].x;
      const dy = allPoints[i].y - allPoints[i - 1].y;
      cumulDist += Math.sqrt(dx * dx + dy * dy);
      allPoints[i].cumDist = cumulDist;
    }
  }

  // Compute tangent angles from finite differences (more accurate than segment-level)
  for (let i = 0; i < allPoints.length; i++) {
    if (i === 0) {
      const dx = allPoints[1].x - allPoints[0].x;
      const dy = allPoints[1].y - allPoints[0].y;
      allPoints[i].tangentAngle = Math.atan2(dy, dx);
    } else if (i === allPoints.length - 1) {
      const dx = allPoints[i].x - allPoints[i - 1].x;
      const dy = allPoints[i].y - allPoints[i - 1].y;
      allPoints[i].tangentAngle = Math.atan2(dy, dx);
    } else {
      const dx = allPoints[i + 1].x - allPoints[i - 1].x;
      const dy = allPoints[i + 1].y - allPoints[i - 1].y;
      allPoints[i].tangentAngle = Math.atan2(dy, dx);
    }
  }

  return {
    points: allPoints,
    totalLength: cumulDist,
    segmentRanges,
    rampThickness,
  };
}

/**
 * Get the position and orientation on the track at a given cumulative distance.
 * Uses linear interpolation between track points.
 */
export function getTrackPosAt(track, dist) {
  const pts = track.points;
  if (dist <= 0) return { ...pts[0], idx: 0 };
  if (dist >= track.totalLength) return { ...pts[pts.length - 1], idx: pts.length - 1 };

  // Binary search for the interval
  let lo = 0, hi = pts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].cumDist <= dist) lo = mid;
    else hi = mid;
  }

  const p0 = pts[lo];
  const p1 = pts[hi];
  const segLen = p1.cumDist - p0.cumDist;
  const t = segLen > 0 ? (dist - p0.cumDist) / segLen : 0;

  return {
    x: p0.x + t * (p1.x - p0.x),
    y: p0.y + t * (p1.y - p0.y),
    tangentAngle: p0.tangentAngle + t * (p1.tangentAngle - p0.tangentAngle),
    type: p0.type,
    curvature: p0.curvature || 0,
    idx: lo,
    cumDist: dist,
  };
}

/**
 * Get the height (y) at a given distance along the track.
 */
export function getHeightAt(track, dist) {
  const pos = getTrackPosAt(track, dist);
  return pos.y;
}

/**
 * Default track segments
 */
export const DEFAULT_SEGMENTS = [
  { type: 'ramp', length: 12, angleDeg: 30 },
  { type: 'flat', length: 4 },
];

/**
 * Get segment display info for the track editor.
 */
export function segmentLabel(seg) {
  switch (seg.type) {
    case 'ramp': return `Ramp ↘ ${seg.angleDeg}° × ${seg.length}m`;
    case 'flat': return `Flat ${seg.length}m`;
    case 'loop': return `Loop ⟳ R=${seg.radius}m`;
    case 'rampUp': return `Ramp ↗ ${seg.angleDeg}° × ${seg.length}m`;
    default: return seg.type;
  }
}
