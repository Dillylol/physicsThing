import React from 'react';
import { Calculator, Zap, RotateCw, ArrowRight, Weight, Gauge } from 'lucide-react';
import { SHAPES } from '../physics/inertia';
import { computePhysicsAt, G } from '../physics/engine';

/**
 * Equations Panel — Shows live physics equations and computed values.
 * Displays:
 * - Total inertia breakdown (compound or single)
 * - Energy equation: E = ½mv² + ½Iω² + mgh
 * - Torque: τ = Iα, τ = FR
 * - Forces: gravity, normal, friction, centripetal, net force
 * - Angular momentum: L = Iω
 * - Acceleration: linear and angular
 */
export default function EquationsPanel({ simState, inertiaData, setup, track }) {
  const initialHeight = track?.points?.[0]?.y || 0;

  // Compute full physics at current position
  const physics = React.useMemo(() => {
    if (!track || !track.points || track.points.length === 0) return null;
    return computePhysicsAt({
      totalMass: inertiaData.totalMass,
      totalInertia: inertiaData.totalInertia,
      effectiveC: inertiaData.effectiveC,
      rollRadius: inertiaData.rollRadius,
      friction: setup.friction,
      track,
      distance: simState.distance || 0,
      initialHeight,
    });
  }, [simState.distance, inertiaData, setup.friction, track, initialHeight]);

  if (!physics) return null;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/50">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-cyan-400" /> Equations & Analysis
        </h2>
      </div>

      <div className="p-4 space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar">
        {/* --- Inertia Breakdown --- */}
        <EquationSection title="Moment of Inertia" icon={<RotateCw className="w-4 h-4" />} color="blue">
          {inertiaData.parts.map((part, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-400">{part.name}</span>
              <span className="font-mono text-blue-300">{part.I.toFixed(4)} kg·m²</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold border-t border-slate-800 pt-2 mt-2">
            <span className="text-slate-300">I_total</span>
            <span className="font-mono text-blue-400">{inertiaData.totalInertia.toFixed(4)} kg·m²</span>
          </div>
          {inertiaData.isCompound && (
            <div className="mt-2 text-[11px] text-slate-500 font-mono bg-slate-950 p-2 rounded">
              I_total = I_inner + 2 × I_outer
            </div>
          )}
          <div className="text-[11px] text-slate-500 font-mono bg-slate-950 p-2 rounded mt-1">
            c = I/(mR²) = {inertiaData.effectiveC.toFixed(4)}
          </div>
        </EquationSection>

        {/* --- Energy --- */}
        <EquationSection title="Energy Conservation" icon={<Zap className="w-4 h-4" />} color="emerald">
          <div className="text-center font-mono text-sm text-slate-400 mb-2 bg-slate-950 p-2 rounded">
            E = ½mv² + ½Iω² + mgh
          </div>
          <div className="grid grid-cols-2 gap-2">
            <EqValue label="½mv²" value={`${physics.KE_trans.toFixed(2)} J`} color="text-emerald-400" />
            <EqValue label="½Iω²" value={`${physics.KE_rot.toFixed(2)} J`} color="text-amber-400" />
            <EqValue label="mgh" value={`${physics.PE.toFixed(2)} J`} color="text-blue-400" />
            <EqValue label="E_total" value={`${physics.totalEnergy.toFixed(2)} J`} color="text-white" bold />
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono bg-slate-950 p-2 rounded">
            v = {physics.velocity.toFixed(3)} m/s &nbsp;|&nbsp; ω = {physics.omega.toFixed(3)} rad/s &nbsp;|&nbsp; h = {physics.height.toFixed(3)} m
          </div>
        </EquationSection>

        {/* --- Forces --- */}
        <EquationSection title="Forces" icon={<ArrowRight className="w-4 h-4" />} color="rose">
          <div className="space-y-1.5">
            <EqRow label="Gravity (mg)" value={`${physics.F_gravity.toFixed(2)} N`} color="text-purple-400" />
            <EqRow label="mg sinθ (∥)" value={`${physics.F_gravity_parallel.toFixed(2)} N`} color="text-purple-300" />
            <EqRow label="mg cosθ (⊥)" value={`${physics.F_gravity_normal.toFixed(2)} N`} color="text-purple-300" />
            <EqRow label="Normal (N)" value={`${physics.F_normal.toFixed(2)} N`} color="text-cyan-400" />
            <EqRow label="Friction (f)" value={`${physics.F_friction.toFixed(2)} N`} color="text-rose-400" />
            {physics.F_centripetal > 0.01 && (
              <EqRow label="Centripetal (Fc)" value={`${physics.F_centripetal.toFixed(2)} N`} color="text-amber-400" />
            )}
            <div className="border-t border-slate-800 pt-1.5 mt-1.5">
              <EqRow label="ΣF (net)" value={`${physics.F_net.toFixed(2)} N`} color="text-white" bold />
            </div>
          </div>
          <div className={`mt-2 text-[11px] font-bold py-1 px-2 rounded flex items-center justify-center border ${
            physics.isSlipping
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
          }`}>
            {physics.isSlipping ? '⚠ SLIDING' : '✓ PURE ROLLING'}
          </div>
        </EquationSection>

        {/* --- Torque --- */}
        <EquationSection title="Torque" icon={<RotateCw className="w-4 h-4" />} color="amber">
          <div className="text-center font-mono text-sm text-slate-400 mb-2 bg-slate-950 p-2 rounded">
            τ = Iα = F·R
          </div>
          <div className="space-y-1.5">
            <EqRow label="τ = Iα" value={`${physics.torque_Ia.toFixed(4)} N·m`} color="text-amber-400" />
            <EqRow label="τ = FR" value={`${physics.torque_FR.toFixed(4)} N·m`} color="text-amber-300" />
            <EqRow label="α (angular accel)" value={`${physics.angularAcceleration.toFixed(4)} rad/s²`} color="text-slate-300" />
            <EqRow label="a (linear accel)" value={`${physics.acceleration.toFixed(4)} m/s²`} color="text-slate-300" />
          </div>
        </EquationSection>

        {/* --- Angular Momentum --- */}
        <EquationSection title="Momentum" icon={<Gauge className="w-4 h-4" />} color="fuchsia">
          <div className="text-center font-mono text-sm text-slate-400 mb-2 bg-slate-950 p-2 rounded">
            L = Iω &nbsp;|&nbsp; p = mv
          </div>
          <div className="space-y-1.5">
            <EqRow label="L (angular)" value={`${physics.angularMomentum.toFixed(4)} kg·m²/s`} color="text-fuchsia-400" />
            <EqRow label="p (linear)" value={`${physics.linearMomentum.toFixed(4)} kg·m/s`} color="text-cyan-400" />
          </div>
        </EquationSection>

        {/* --- Track Info --- */}
        <EquationSection title="Current Position" icon={<Weight className="w-4 h-4" />} color="slate">
          <div className="space-y-1.5">
            <EqRow label="Distance" value={`${(simState.distance || 0).toFixed(2)} m`} color="text-slate-300" />
            <EqRow label="Segment" value={physics.segmentType || 'N/A'} color="text-slate-300" />
            <EqRow label="Surface Angle" value={`${((physics.tangentAngle || 0) * 180 / Math.PI).toFixed(1)}°`} color="text-slate-300" />
            {physics.curvature > 0 && (
              <EqRow label="Curvature (1/R)" value={`${physics.curvature.toFixed(4)} m⁻¹`} color="text-amber-300" />
            )}
          </div>
        </EquationSection>
      </div>
    </section>
  );
}

// --- Sub-components ---

function EquationSection({ title, icon, color, children }) {
  const colorMap = {
    blue: 'text-blue-400 border-blue-500/20',
    emerald: 'text-emerald-400 border-emerald-500/20',
    rose: 'text-rose-400 border-rose-500/20',
    amber: 'text-amber-400 border-amber-500/20',
    fuchsia: 'text-fuchsia-400 border-fuchsia-500/20',
    cyan: 'text-cyan-400 border-cyan-500/20',
    slate: 'text-slate-400 border-slate-700',
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`border rounded-lg p-3 ${c.split(' ')[1]}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${c.split(' ')[0]}`}>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function EqValue({ label, value, color, bold }) {
  return (
    <div className="bg-slate-950 rounded p-2 text-center">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`font-mono text-sm ${color} ${bold ? 'font-bold' : ''}`}>{value}</div>
    </div>
  );
}

function EqRow({ label, value, color, bold }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${color} ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
