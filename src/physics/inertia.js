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
