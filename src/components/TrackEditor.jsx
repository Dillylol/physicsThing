import React, { useState } from 'react';
import { Waypoints, Plus, Trash2, ChevronUp, ChevronDown, Ruler, BookOpen } from 'lucide-react';
import { segmentLabel, TRACK_PRESETS } from '../physics/trackBuilder';

/**
 * Track Editor Panel — Add, remove, reorder track segments.
 * Supports: Ramp, Flat, Loop, Ramp Up.
 * Track Width is binary: Normal or Thin (for compound inner-rolling).
 */
export default function TrackEditor({ segments, onSegmentsChange, trackWidth, onWidthChange }) {
  const [addType, setAddType] = useState('ramp');

  const addSegment = () => {
    const defaults = {
      ramp: { type: 'ramp', length: 8, angleDeg: 25 },
      flat: { type: 'flat', length: 5 },
      loop: { type: 'loop', radius: 3 },
      rampUp: { type: 'rampUp', length: 5, angleDeg: 15 },
    };
    onSegmentsChange([...segments, { ...defaults[addType] }]);
  };

  const removeSegment = (idx) => {
    if (segments.length <= 1) return;
    onSegmentsChange(segments.filter((_, i) => i !== idx));
  };

  const moveSegment = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= segments.length) return;
    const arr = [...segments];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onSegmentsChange(arr);
  };

  const updateSegment = (idx, key, value) => {
    const arr = [...segments];
    arr[idx] = { ...arr[idx], [key]: value };
    onSegmentsChange(arr);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100 flex items-center mb-4">
        <Waypoints className="w-5 h-5 mr-2 text-emerald-400" /> Track Editor
      </h2>

      {/* Track Presets */}
      <div className="mb-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center mb-2">
          <BookOpen className="w-3.5 h-3.5 mr-1" /> Presets (FRQ Scenarios)
        </label>
        <div className="space-y-1.5">
          {Object.entries(TRACK_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => onSegmentsChange([...preset.segments])}
              className="w-full text-left px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-emerald-500/50 transition-all text-sm"
            >
              <span className="font-medium">{preset.name}</span>
              <span className="block text-[10px] text-slate-500 mt-0.5">{preset.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Track Width (Binary Toggle) */}
      <div className="mb-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center mb-2">
          <Ruler className="w-3.5 h-3.5 mr-1" /> Track Width
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onWidthChange('normal')}
            className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-all ${
              trackWidth === 'normal'
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-medium'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => onWidthChange('thin')}
            className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-all ${
              trackWidth === 'thin'
                ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-medium'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            Thin
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5">
          {trackWidth === 'thin'
            ? 'Thin track — smaller object contacts the surface (e.g., yoyo axle)'
            : 'Normal width — larger object contacts the surface'}
        </p>
      </div>

      {/* Segment List */}
      <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {segments.map((seg, idx) => (
          <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 group hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  seg.type === 'ramp' ? 'bg-blue-500' :
                  seg.type === 'flat' ? 'bg-slate-500' :
                  seg.type === 'loop' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} />
                <span className="text-sm font-medium text-slate-300">{segmentLabel(seg)}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => moveSegment(idx, -1)} className="p-1 text-slate-500 hover:text-slate-300" title="Move up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moveSegment(idx, 1)} className="p-1 text-slate-500 hover:text-slate-300" title="Move down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeSegment(idx)} className="p-1 text-slate-500 hover:text-rose-400" title="Remove">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Segment-specific controls */}
            <div className="space-y-1.5">
              {(seg.type === 'ramp' || seg.type === 'rampUp') && (
                <>
                  <MiniSlider label="Length" value={seg.length} min={2} max={20} step={0.5} unit="m"
                    onChange={(v) => updateSegment(idx, 'length', v)} />
                  <MiniSlider label="Angle" value={seg.angleDeg} min={5} max={60} step={1} unit="°"
                    onChange={(v) => updateSegment(idx, 'angleDeg', v)} />
                </>
              )}
              {seg.type === 'flat' && (
                <MiniSlider label="Length" value={seg.length} min={1} max={20} step={0.5} unit="m"
                  onChange={(v) => updateSegment(idx, 'length', v)} />
              )}
              {seg.type === 'loop' && (
                <MiniSlider label="Radius" value={seg.radius} min={1} max={10} step={0.5} unit="m"
                  onChange={(v) => updateSegment(idx, 'radius', v)} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Segment */}
      <div className="flex gap-2">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        >
          <option value="ramp">Ramp ↘</option>
          <option value="flat">Flat —</option>
          <option value="loop">Loop ⟳</option>
          <option value="rampUp">Ramp Up ↗</option>
        </select>
        <button
          onClick={addSegment}
          className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </button>
      </div>
    </section>
  );
}

function MiniSlider({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-slate-500 h-1"
      />
      <span className="text-[11px] font-mono text-slate-400 w-12 text-right">{value}{unit}</span>
    </div>
  );
}
