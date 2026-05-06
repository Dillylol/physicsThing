/**
 * Inertia calculation module for single and compound objects.
 * 
 * Single mode: Solid Disk, Hollow Hoop, Solid Sphere, Hollow Sphere
 * Compound mode (Hoop/Disk only): 3-part coaxial system — center object + 2 side objects.
 *   - If side objects are larger → "wheel" shape (center hub with outer flanges)
 *   - If side objects are smaller → "yoyo" shape (large center, small side pieces)
 *   - rollsOnInner: determines whether the center or the sides contact the track
 */

// Shape definitions with inertia coefficients
export const SHAPES = {
  solid_disk: {
    name: 'Solid Disk',
    c: 0.5,
    color: '#3b82f6',
    desc: 'I = ½mR²',
    inertiaFormula: (m, r) => 0.5 * m * r * r,
  },
  hoop: {
    name: 'Hollow Hoop',
    c: 1.0,
    color: '#ef4444',
    desc: 'I = mR²',
    inertiaFormula: (m, r) => m * r * r,
  },
  solid_hoop: {
    name: 'Solid Hoop',
    c: 1.0,
    color: '#f97316',
    desc: 'I = mR²',
    inertiaFormula: (m, r) => m * r * r,
  },
  solid_sphere: {
    name: 'Solid Sphere',
    c: 0.4,
    color: '#10b981',
    desc: 'I = ⅖mR²',
    inertiaFormula: (m, r) => 0.4 * m * r * r,
  },
  hollow_sphere: {
    name: 'Hollow Sphere',
    c: 2 / 3,
    color: '#f59e0b',
    desc: 'I = ⅔mR²',
    inertiaFormula: (m, r) => (2 / 3) * m * r * r,
  },
};

// Only disk and hoop are allowed for compound systems
export const COMPOUND_SHAPES = {
  solid_disk: SHAPES.solid_disk,
  hoop: SHAPES.hoop,
  solid_hoop: SHAPES.solid_hoop,
};

/**
 * Object presets matching FRQ experimental objects.
 * FRQ2 uses I = bmr² where b characterizes the mass distribution.
 * The minimum height to complete a loop of radius R is h = R(5 + b)/2.
 */
export const OBJECT_PRESETS = {
  solid_sphere: {
    name: 'Solid Sphere',
    desc: 'b = 2/5 = 0.40',
    shapeKey: 'solid_sphere',
    mass: 2,
    radius: 0.3,
    b: 0.4,
    isCompound: false,
  },
  hollow_sphere: {
    name: 'Hollow Sphere',
    desc: 'b = 2/3 ≈ 0.67',
    shapeKey: 'hollow_sphere',
    mass: 2,
    radius: 0.3,
    b: 2 / 3,
    isCompound: false,
  },
  solid_cylinder: {
    name: 'Solid Cylinder',
    desc: 'b = 1/2 = 0.50',
    shapeKey: 'solid_disk',
    mass: 2,
    radius: 0.3,
    b: 0.5,
    isCompound: false,
  },
  hollow_cylinder: {
    name: 'Hollow Cylinder (Hoop)',
    desc: 'b = 1.0',
    shapeKey: 'hoop',
    mass: 2,
    radius: 0.3,
    b: 1.0,
    isCompound: false,
  },
  frq1_toy: {
    name: 'FRQ1 Compound Toy',
    desc: '3 coaxial cylinders: center (M, R) + 2 outer (M, 2R)',
    isCompound: true,
    centerShape: 'solid_disk',
    centerMass: 2,
    centerRadius: 0.5,
    sideShape: 'solid_disk',
    sideMass: 2,
    sideRadius: 1.0,
    rollsOnInner: true,
    b: 1.5,
  },
};

/**
 * Calculate minimum release height to complete a loop (FRQ2 formula).
 * At the top of the loop: N >= 0 requires v² >= gR
 * Energy conservation: mgh = ½mv²(1+b) + mg(2R)
 * With v² = gR: h_min = R(5 + b) / 2
 */
export function minimumLoopHeight(loopRadius, b) {
  return loopRadius * (5 + b) / 2;
}

/**
 * Calculate the speed at the top of the loop given release height h.
 * mgh = ½mv²_top(1+b) + mg(2R)
 * v²_top = 2g(h - 2R) / (1 + b)
 */
export function speedAtLoopTop(h, loopRadius, b) {
  const heightAboveBottom = h - 2 * loopRadius;
  if (heightAboveBottom <= 0) return 0;
  return Math.sqrt(2 * 9.81 * heightAboveBottom / (1 + b));
}

/**
 * Calculate normal force at the top of a loop.
 * At top: N + mg = mv²/R → N = m(v²/R - g)
 * N < 0 means the object loses contact.
 */
export function normalForceAtLoopTop(mass, speed, loopRadius) {
  return mass * (speed * speed / loopRadius - 9.81);
}

/**
 * Calculate inertia for a single object.
 */
export function singleInertia(shapeKey, mass, radius) {
  const shape = SHAPES[shapeKey];
  if (!shape) return 0;
  return shape.inertiaFormula(mass, radius);
}

/**
 * Calculate total inertia for a compound system.
 * System: 1 center object + 2 side objects, coaxial.
 * 
 * @param {string} centerShapeKey - 'solid_disk' or 'hoop'
 * @param {number} centerMass - mass of the center object (kg)
 * @param {number} centerRadius - radius of the center object (m)
 * @param {string} sideShapeKey - 'solid_disk' or 'hoop'
 * @param {number} sideMass - mass of each side object (kg)
 * @param {number} sideRadius - radius of each side object (m)
 * @param {boolean} rollsOnInner - if true, the smaller radius contacts the track (thin track mode)
 */
export function compoundInertia(centerShapeKey, centerMass, centerRadius, sideShapeKey, sideMass, sideRadius, rollsOnInner = false) {
  const centerI = singleInertia(centerShapeKey, centerMass, centerRadius);
  const sideI = singleInertia(sideShapeKey, sideMass, sideRadius);
  const totalInertia = centerI + 2 * sideI;
  const totalMass = centerMass + 2 * sideMass;

  // Determine which radius contacts the track
  const maxR = Math.max(centerRadius, sideRadius);
  const minR = Math.min(centerRadius, sideRadius);
  let rollRadius;

  if (rollsOnInner) {
    // Thin track: the smaller radius rolls (e.g., yoyo rolling on its axle)
    rollRadius = minR;
  } else {
    // Normal track: the larger radius rolls
    rollRadius = maxR;
  }

  const isYoyo = sideRadius < centerRadius; // sides smaller than center

  return {
    totalInertia,
    totalMass,
    centerI,
    sideI,
    effectiveC: totalInertia / (totalMass * rollRadius * rollRadius),
    rollRadius,
    centerRadius,
    sideRadius,
    isYoyo,
    parts: [
      { name: `Center ${COMPOUND_SHAPES[centerShapeKey]?.name || centerShapeKey}`, I: centerI, mass: centerMass, radius: centerRadius, shape: centerShapeKey },
      { name: `Side ${COMPOUND_SHAPES[sideShapeKey]?.name || sideShapeKey} ×2`, I: 2 * sideI, mass: 2 * sideMass, radius: sideRadius, shape: sideShapeKey },
    ],
  };
}

/**
 * Build the inertia data from the setup configuration.
 * Handles both single and compound modes.
 */
export function buildInertiaFromSetup(setup) {
  if (setup.isCompound) {
    const result = compoundInertia(
      setup.centerShape, setup.centerMass, setup.centerRadius,
      setup.sideShape, setup.sideMass, setup.sideRadius,
      setup.rollsOnInner
    );
    return {
      totalInertia: result.totalInertia,
      totalMass: result.totalMass,
      effectiveC: result.effectiveC,
      rollRadius: result.rollRadius,
      centerRadius: result.centerRadius,
      sideRadius: result.sideRadius,
      isYoyo: result.isYoyo,
      parts: result.parts,
      isCompound: true,
      rollsOnInner: setup.rollsOnInner,
    };
  } else {
    const I = singleInertia(setup.shapeKey, setup.mass, setup.radius);
    const c = SHAPES[setup.shapeKey]?.c || 0.5;
    return {
      totalInertia: I,
      totalMass: setup.mass,
      effectiveC: c,
      rollRadius: setup.radius,
      parts: [{ name: SHAPES[setup.shapeKey]?.name || setup.shapeKey, I, mass: setup.mass, radius: setup.radius, shape: setup.shapeKey }],
      isCompound: false,
    };
  }
}
