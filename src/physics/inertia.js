/**
 * Inertia calculation module for single and compound objects.
 * Supports Solid Disk and Hollow Hoop, both single and compound (system) configurations.
 * 
 * Compound system: A smaller inner radius object sandwiched between two larger outer objects.
 * Example: A small inner disk between two larger outer hoops, all sharing the same axis.
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
 * System: 1 inner object + 2 outer objects, coaxial.
 * 
 * @param {string} innerShapeKey - 'solid_disk' or 'hoop'
 * @param {number} innerMass - mass of the inner object (kg)
 * @param {number} innerRadius - radius of the inner object (m)
 * @param {string} outerShapeKey - 'solid_disk' or 'hoop'
 * @param {number} outerMass - mass of each outer object (kg)
 * @param {number} outerRadius - radius of each outer object (m)
 * @returns {{ totalInertia: number, totalMass: number, innerI: number, outerI: number, parts: object[] }}
 */
export function compoundInertia(innerShapeKey, innerMass, innerRadius, outerShapeKey, outerMass, outerRadius) {
  const innerI = singleInertia(innerShapeKey, innerMass, innerRadius);
  const outerI = singleInertia(outerShapeKey, outerMass, outerRadius);
  const totalInertia = innerI + 2 * outerI;
  const totalMass = innerMass + 2 * outerMass;

  return {
    totalInertia,
    totalMass,
    innerI,
    outerI,
    effectiveC: totalInertia / (totalMass * outerRadius * outerRadius), // effective c for rolling
    rollRadius: outerRadius, // the outer radius is what contacts the surface
    parts: [
      { name: `Inner ${SHAPES[innerShapeKey].name}`, I: innerI, mass: innerMass, radius: innerRadius, shape: innerShapeKey },
      { name: `Outer ${SHAPES[outerShapeKey].name} ×2`, I: 2 * outerI, mass: 2 * outerMass, radius: outerRadius, shape: outerShapeKey },
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
      setup.innerShape, setup.innerMass, setup.innerRadius,
      setup.outerShape, setup.outerMass, setup.outerRadius
    );
    return {
      totalInertia: result.totalInertia,
      totalMass: result.totalMass,
      effectiveC: result.effectiveC,
      rollRadius: result.rollRadius,
      parts: result.parts,
      isCompound: true,
    };
  } else {
    const I = singleInertia(setup.shapeKey, setup.mass, setup.radius);
    const c = SHAPES[setup.shapeKey].c;
    return {
      totalInertia: I,
      totalMass: setup.mass,
      effectiveC: c,
      rollRadius: setup.radius,
      parts: [{ name: SHAPES[setup.shapeKey].name, I, mass: setup.mass, radius: setup.radius, shape: setup.shapeKey }],
      isCompound: false,
    };
  }
}
