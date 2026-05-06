/**
 * Physics Engine — Core simulation math.
 * 
 * Handles:
 * - Rolling dynamics on arbitrary track geometry
 * - Energy calculations (KE_trans, KE_rot, PE)
 * - Force calculations (gravity, normal, friction, centripetal)
 * - Torque (τ = Iα, τ = FR)
 * - Angular momentum (L = Iω)
 * - Slip detection
 */

const G = 9.81;

/**
 * Compute the physics state at a given position along the track.
 * Uses energy conservation + track geometry.
 * 
 * @param {object} params
 * @param {number} params.totalMass - total mass of the system (kg)
 * @param {number} params.totalInertia - total moment of inertia (kg·m²)
 * @param {number} params.effectiveC - I/(mR²) ratio
 * @param {number} params.rollRadius - radius that contacts the surface (m)
 * @param {number} params.friction - coefficient of friction
 * @param {object} params.track - track data from buildTrack()
 * @param {number} params.distance - cumulative distance along the track (m)
 * @param {number} params.initialHeight - height of the starting point (m)
 * @returns {object} Complete physics state
 */
export function computePhysicsAt(params) {
  const { totalMass: m, totalInertia: I, effectiveC: c, rollRadius: R, friction: mu, track, distance: d, initialHeight: h0 } = params;

  // Get position on track
  const pos = getTrackPosAtImport(track, d);
  const h = pos.y;

  // Energy conservation: mgh₀ = mgh + ½mv² + ½Iω²
  // For pure rolling: ω = v/R, so ½Iω² = ½I(v/R)² = ½(I/R²)v² = ½(cm)v²
  // Total KE = ½mv²(1 + c)
  // v² = 2g(h₀ - h) / (1 + c) [if pure rolling, no friction loss]
  
  const heightDrop = h0 - h;
  const vSquared = Math.max(0, (2 * G * heightDrop) / (1 + c));
  const v = Math.sqrt(vSquared);
  const omega = v / R;

  // Local track geometry
  const tangentAngle = pos.tangentAngle || 0;
  const slopeAngle = -tangentAngle; // angle from horizontal, positive = downhill
  const curvature = pos.curvature || 0;

  // --- FORCES ---
  // Gravity component along the track
  const F_gravity = m * G;
  const F_gravity_parallel = m * G * Math.sin(Math.abs(tangentAngle));
  const F_gravity_normal = m * G * Math.cos(tangentAngle);

  // Normal force
  let F_normal;
  if (curvature > 0) {
    // In a loop: N = mv²/r - mg*cos(θ_loop) (at various positions in the loop)
    // More precisely: centripetal acceleration = v²/r
    const r = 1 / curvature;
    // The angle in the loop determines how gravity contributes
    F_normal = m * v * v * curvature + F_gravity_normal;
  } else {
    F_normal = F_gravity_normal;
  }

  // Friction force (for rolling without slipping)
  const muCrit = (c / (1 + c)) * Math.tan(Math.abs(tangentAngle) || 0.001);
  const isSlipping = mu < muCrit && Math.abs(tangentAngle) > 0.01;

  let F_friction;
  let a_linear;
  let alpha;

  if (isSlipping) {
    F_friction = mu * F_normal;
    a_linear = G * Math.sin(Math.abs(tangentAngle)) - mu * G * Math.cos(tangentAngle);
    alpha = (F_friction * R) / I;
  } else {
    a_linear = (G * Math.sin(Math.abs(tangentAngle))) / (1 + c);
    F_friction = c * m * a_linear;
    alpha = a_linear / R;
  }

  // Centripetal force (on loops)
  let F_centripetal = 0;
  if (curvature > 0) {
    F_centripetal = m * v * v * curvature;
  }

  // --- TORQUE ---
  const torque_Ia = I * alpha;
  const torque_FR = F_friction * R;

  // --- ENERGY ---
  const PE = m * G * h;
  const KE_trans = 0.5 * m * v * v;
  const KE_rot = 0.5 * I * omega * omega;
  const totalEnergy = PE + KE_trans + KE_rot;

  // --- ANGULAR MOMENTUM ---
  const L = I * omega;

  // --- NET FORCE ---
  // Along the track surface
  const F_net = m * a_linear;

  return {
    // Position
    x: pos.x,
    y: pos.y,
    distance: d,
    tangentAngle,
    segmentType: pos.type,
    curvature,

    // Kinematics
    velocity: v,
    omega,
    acceleration: a_linear,
    angularAcceleration: alpha,
    height: h,

    // Energy
    PE,
    KE_trans,
    KE_rot,
    totalEnergy,

    // Forces
    F_gravity,
    F_gravity_parallel,
    F_gravity_normal,
    F_normal,
    F_friction,
    F_centripetal,
    F_net,

    // Torque
    torque_Ia,
    torque_FR,

    // Momentum
    angularMomentum: L,
    linearMomentum: m * v,

    // Status
    isSlipping,
  };
}

/**
 * Step the simulation forward by dt using Euler integration on the track.
 * This is more accurate than pure energy conservation because it handles
 * friction losses and non-conservative forces.
 */
export function stepSimulation(state, dt, params) {
  const { totalMass: m, totalInertia: I, effectiveC: c, rollRadius: R, friction: mu, track } = params;

  const pos = getTrackPosAtImport(track, state.distance);
  const tangentAngle = pos.tangentAngle || 0;

  // Gravity component along the track (positive = accelerating downhill)
  const sinA = Math.sin(Math.abs(tangentAngle));
  const cosA = Math.cos(tangentAngle);
  const curvature = pos.curvature || 0;

  const muCrit = (c / (1 + c)) * Math.tan(Math.abs(tangentAngle) || 0.001);
  const isSlipping = mu < muCrit && sinA > 0.01;

  let a;
  if (isSlipping) {
    a = G * (sinA - mu * cosA);
  } else {
    a = (G * sinA) / (1 + c);
  }

  // Direction: if tangent angle is negative (going downhill), acceleration is positive (forward)
  // if tangent angle is positive (going uphill), gravity decelerates
  if (tangentAngle > 0.01) {
    a = -a; // Going uphill, decelerate
  }

  let newVelocity = state.velocity + a * dt;
  // Don't allow negative velocity (the object would need to go backwards)
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
    isSlipping,
    acceleration: a,
    x: newPos.x,
    y: newPos.y,
    tangentAngle: newPos.tangentAngle,
    segmentType: newPos.type,
    curvature: newPos.curvature || 0,
    finished: newDistance >= track.totalLength,
  };
}

// Internal import helper — we'll inline the function to avoid circular deps
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
 * Calculate the minimum speed needed at the BOTTOM of a loop to complete it.
 * At the top: mg = mv²/R → v²_top = gR (minimum condition)
 * Energy conservation (bottom→top): ½mv²_bot(1+c) = ½mv²_top(1+c) + mg(2R)
 * v²_bot = v²_top + 4gR/(1+c) = gR + 4gR/(1+c) = gR[(1+c+4)/(1+c)] = gR(5+c)/(1+c)
 */
export function loopMinSpeed(radius, c) {
  return Math.sqrt(G * radius * (5 + c) / (1 + c));
}

/**
 * Minimum release height above the loop bottom to complete the loop.
 * Uses energy conservation with rolling: h_min = R(5+b)/2 where b = I/(mR²)
 * This is the key result from FRQ Problem 2.
 */
export function loopMinHeight(radius, b) {
  return radius * (5 + b) / 2;
}

export { G };
