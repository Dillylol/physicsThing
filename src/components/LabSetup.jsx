import React from 'react';
import { SHAPES, COMPOUND_SHAPES } from '../physics/inertia';
import { Settings2, Check, Layers } from 'lucide-react';

/**
 * Lab Setup Panel — Configure object type, mass, radius, friction.
 * Supports compound inertia mode (hoop/disk only) with center + 2 side objects.
 * Compound can be yoyo (sides smaller) or wheel (sides larger).
 */
export default function LabSetup({ setup, onChange }) {
  const handleChange = (key, value) => onChange({ ...setup, [key]: value });

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100 flex items-center mb-5">
        <Settings2 className="w-5 h-5 mr-2 text-blue-400" /> Lab Setup
      </h2>

      <div className="space-y-4">
        {/* Object Type */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Object Type
          </label>
          <div className="space-y-1.5">
            {Object.entries(SHAPES).map(([key, data]) => (
              <button
                key={key}
                onClick={() => handleChange('shapeKey', key)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between transition-all duration-200 ${
                  setup.shapeKey === key
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300 shadow-md shadow-blue-500/10'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <span className="font-medium">{data.name}</span>
                  <span className="text-xs text-slate-500 ml-2">{data.desc}</span>
                </div>
                {setup.shapeKey === key && <Check className="w-4 h-4 text-blue-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Compound Mode Toggle */}
        <div className="pt-3 border-t border-slate-800/50">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={setup.isCompound || false}
              onChange={(e) => handleChange('isCompound', e.target.checked)}
              className="form-checkbox h-4 w-4 text-fuchsia-500 rounded border-slate-700 bg-slate-800"
            />
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors flex items-center">
              <Layers className="w-4 h-4 mr-1.5 text-fuchsia-400" />
              Compound System
            </span>
          </label>
          <p className="text-[10px] text-slate-600 mt-1 ml-7">
            3-part system: center + 2 side objects (Hoop/Disk only)
          </p>
        </div>

        {/* Single object controls */}
        {!setup.isCompound && (
          <>
            <SliderControl
              label="Mass"
              value={setup.mass}
              min={0.5} max={20} step={0.5}
              unit="kg"
              color="blue"
              onChange={(v) => handleChange('mass', v)}
            />
            <SliderControl
              label="Radius"
              value={setup.radius}
              min={0.2} max={2.0} step={0.05}
              unit="m"
              color="blue"
              onChange={(v) => handleChange('radius', v)}
            />
          </>
        )}

        {/* Compound object controls */}
        {setup.isCompound && (
          <div className="space-y-3 p-3 bg-fuchsia-950/20 border border-fuchsia-500/20 rounded-lg">
            {/* Center Object */}
            <h4 className="text-xs font-semibold text-fuchsia-400 uppercase tracking-wider">Center Object</h4>
            <div className="flex gap-2">
              {Object.keys(COMPOUND_SHAPES).map(key => (
                <button key={key} onClick={() => handleChange('centerShape', key)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded border transition-all ${
                    setup.centerShape === key
                      ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {COMPOUND_SHAPES[key].name}
                </button>
              ))}
            </div>
            <SliderControl label="Center Mass" value={setup.centerMass || 2} min={0.1} max={10} step={0.1} unit="kg" color="fuchsia" onChange={(v) => handleChange('centerMass', v)} />
            <SliderControl label="Center Radius" value={setup.centerRadius || 0.5} min={0.1} max={2.0} step={0.05} unit="m" color="fuchsia" onChange={(v) => handleChange('centerRadius', v)} />

            {/* Side Objects */}
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mt-3">Side Objects (×2)</h4>
            <div className="flex gap-2">
              {Object.keys(COMPOUND_SHAPES).map(key => (
                <button key={key} onClick={() => handleChange('sideShape', key)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded border transition-all ${
                    setup.sideShape === key
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {COMPOUND_SHAPES[key].name}
                </button>
              ))}
            </div>
            <SliderControl label="Each Side Mass" value={setup.sideMass || 1} min={0.1} max={10} step={0.1} unit="kg" color="amber" onChange={(v) => handleChange('sideMass', v)} />
            <SliderControl label="Side Radius" value={setup.sideRadius || 0.3} min={0.05} max={2.0} step={0.05} unit="m" color="amber" onChange={(v) => handleChange('sideRadius', v)} />

            {/* Shape Preview Label */}
            <div className={`mt-2 text-[11px] font-bold py-1.5 px-3 rounded flex items-center justify-center border ${
              (setup.sideRadius || 0.3) < (setup.centerRadius || 0.5)
                ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {(setup.sideRadius || 0.3) < (setup.centerRadius || 0.5) ? '🪀 Yoyo Configuration' : '⚙ Wheel Configuration'}
            </div>

            {/* Rolling Surface Toggle */}
            <div className="mt-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Rolling Contact
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleChange('rollsOnInner', false)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded border transition-all ${
                    !setup.rollsOnInner
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  Larger radius rolls
                </button>
                <button
                  onClick={() => handleChange('rollsOnInner', true)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded border transition-all ${
                    setup.rollsOnInner
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  Smaller radius rolls
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">
                {setup.rollsOnInner
                  ? 'Thin track — smaller part contacts the surface'
                  : 'Normal track — larger part contacts the surface'}
              </p>
            </div>
          </div>
        )}

        {/* Friction */}
        <div className="pt-3 border-t border-slate-800/50">
          <SliderControl
            label="Surface Friction"
            value={setup.friction}
            min={0} max={1} step={0.05}
            unit=""
            color="rose"
            onChange={(v) => handleChange('friction', v)}
          />
        </div>

        {/* Show Forces */}
        <div className="pt-3 border-t border-slate-800/50">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={setup.showForces}
              onChange={(e) => handleChange('showForces', e.target.checked)}
              className="form-checkbox h-4 w-4 text-slate-500 rounded border-slate-700 bg-slate-800"
            />
            <span className="text-sm text-slate-400">Show Force Vectors</span>
          </label>
        </div>
      </div>
    </section>
  );
}

function SliderControl({ label, value, min, max, step, unit, color, onChange }) {
  const colorMap = {
    blue: { text: 'text-blue-400', accent: 'accent-blue-500' },
    emerald: { text: 'text-emerald-400', accent: 'accent-emerald-500' },
    rose: { text: 'text-rose-400', accent: 'accent-rose-500' },
    fuchsia: { text: 'text-fuchsia-400', accent: 'accent-fuchsia-500' },
    amber: { text: 'text-amber-400', accent: 'accent-amber-500' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-slate-300">{label}</label>
        <span className={`text-sm font-mono ${c.text}`}>
          {typeof value === 'number' ? value.toFixed(step < 0.1 ? 2 : 1) : value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full ${c.accent}`}
      />
    </div>
  );
}
