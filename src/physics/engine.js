/**
 * Physics Engine — Core simulation math.
 * 
 * Assumes pure rolling without slipping (as in AP Physics C FRQs).
 * Friction is derived from the rolling constraint: f = cma
 * 
 * Handles:
 * - Rolling dynamics on arbitrary track geometry
 * - Energy calculations (KE_trans, KE_rot, PE)
 * - Force calculations (gravity, normal, friction as derived, centripetal)
 * - Torque (τ = Iα, τ = fR)
 * - Angular momentum (L = Iω)
 */

const G = 9.81;

/**
 * Compute the physics state at a given position along the track.
 * Uses energy conservation for pure rolling without slipping.
 * 
 * @param {object} params
 * @param {number} params.totalMass - total mass of the system (kg)
 * @param {number} params.totalInertia - total moment of inertia (kg·m²)
 * @param {number} params.effectiveC - I/(mR²) ratio (b value)
 * @param {number} params.rollRadius - radius that contacts the surface (m)
 * @param {object} params.track - track data from buildTrack()
 * @param {number} params.distance - cumulative distance along the track (m)
 * @param {number} params.initialHeight - height of the starting point (m)
 * @returns {object} Complete physics state
 */
export function computePhysicsAt(params) {
  const { totalMass: m, totalInertia: I, effectiveC: c, rollRadius: R, track, distance: d, initialHeight: h0 } = params;

  const pos = getTrackPosAtImport(track, d);
  const h = pos.y;

  // Energy conservation (pure rolling): mgh₀ = mgh + ½mv²(1 + c)
  // v² = 2g(h₀ - h) / (1 + c)
  const heightDrop = h0 - h;
  const vSquared = Math.max(0, (2 * G * heightDrop) / (1 + c));
  const v = Math.sqrt(vSquared);
  const omega = v / R;

  // Local track geometry
  const tangentAngle = pos.tangentAngle || 0;
  const curvature = pos.curvature || 0;

  // --- FORCES ---
  const F_gravity = m * G;
  const F_gravity_parallel = m * G * Math.sin(Math.abs(tangentAngle));
  const F_gravity_normal = m * G * Math.cos(tangentAngle);

  // Normal force (includes centripetal contribution in curves)
  let F_normal;
  if (curvature > 0) {
    F_normal = m * v * v * curvature + F_gravity_normal;
  } else {
    F_normal = F_gravity_normal;
  }

  // Pure rolling acceleration: a = g sinθ / (1 + c)
  const a_linear = (G * Math.sin(Math.abs(tangentAngle))) / (1 + c);
  const alpha = a_linear / R;

  // Friction force derived from rolling constraint: f = cma
  const F_friction = c * m * a_linear;

  // Centripetal force (in loops)
  let F_centripetal = 0;
  if (curvature > 0) {
    F_centripetal = m * v * v * curvature;
  }

  // --- TORQUE ---
  const torque = F_friction * R; // τ = fR = Iα

  // --- ENERGY ---
  const PE = m * G * h;
  const KE_trans = 0.5 * m * v * v;
  const KE_rot = 0.5 * I * omega * omega;
  const totalEnergy = PE + KE_trans + KE_rot;

  // --- ANGULAR MOMENTUM ---
  const L = I * omega;

  // --- NET FORCE ---
  const F_net = m * a_linear;

  return {
    x: pos.x,
    y: pos.y,
    distance: d,
    tangentAngle,
    segmentType: pos.type,
    curvature,

    velocity: v,
    omega,
    acceleration: a_linear,
    angularAcceleration: alpha,
    height: h,

    PE,
    KE_trans,
    KE_rot,
    totalEnergy,

    F_gravity,
    F_gravity_parallel,
    F_gravity_normal,
    F_normal,
    F_friction,
    F_centripetal,
    F_net,

    torque,

    angularMomentum: L,
    linearMomentum: m * v,
  };
}

/**
 * Step the simulation forward by dt using Euler integration.
 * Pure rolling without slipping: a = g sinθ / (1 + c)
 */
export function stepSimulation(state, dt, params) {
  const { totalMass: m, totalInertia: I, effectiveC: c, rollRadius: R, track } = params;

  const pos = getTrackPosAtImport(track, state.distance);
  const tangentAngle = pos.tangentAngle || 0;
  const sinA = Math.sin(Math.abs(tangentAngle));
  const curvature = pos.curvature || 0;

  // Pure rolling acceleration
  let a = (G * sinA) / (1 + c);

  // Direction: uphill decelerates, downhill accelerates
  if (tangentAngle > 0.01) {
    a = -a;
  }

  let newVelocity = state.velocity + a * dt;
  if (newVelocity < 0) newVelocity = 0;

  let newDistance = state.distance + state.velocity * dt + 0.5 * a * dt * dt;
  if (newDistance < 0) newDistance = 0;
  if (newDistance > track.totalLength) newDistance = track.totalLength;

  const omega = newVelocity / R;
  const thetaRot = state.thetaRot + omega * dt;

  const newPos = getTrackPosAtImport(track, newDistance);
  const h = newPos.y;

  const PE = m * G * h;
  const KE_trans = 0.5 * m * newVelocity * newVelocity;
  const KE_rot = 0.5 * I * omega * omega;

  return {
    distance: newDistance,
    velocity: newVelocity,
    omega,
    thetaRot,
    time: state.time + dt,
    PE,
    KE_trans,
    KE_rot,
    totalEnergy: PE + KE_trans + KE_rot,
    angularMomentum: I * omega,
    linearMomentum: m * newVelocity,
    acceleration: a,
    x: newPos.x,
    y: newPos.y,
    tangentAngle: newPos.tangentAngle,
    segmentType: newPos.type,
    curvature: newPos.curvature || 0,
    finished: newDistance >= track.totalLength,
  };
}

function getTrackPosAtImport(track, dist) {
  const pts = track.points;
  if (!pts || pts.length === 0) return { x: 0, y: 0, tangentAngle: 0, type: 'flat', curvature: 0 };
  if (dist <= 0) return { ...pts[0], idx: 0 };
  if (dist >= track.totalLength) return { ...pts[pts.length - 1], idx: pts.length - 1 };

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
    tangentAngle: p0.tangentAngle + t * ((p1.tangentAngle || 0) - (p0.tangentAngle || 0)),
    type: p0.type,
    curvature: p0.curvature || 0,
    idx: lo,
    cumDist: dist,
  };
}

/**
 * Minimum speed at the BOTTOM of a loop to complete it (pure rolling).
 * v²_bot = gR(5+c)/(1+c)
 */
export function loopMinSpeed(radius, c) {
  return Math.sqrt(G * radius * (5 + c) / (1 + c));
}

/**
 * Minimum release height above loop bottom to complete the loop.
 * h_min = R(5+b)/2 where b = I/(mR²)
 */
export function loopMinHeight(radius, b) {
  return radius * (5 + b) / 2;
}

export { G };
