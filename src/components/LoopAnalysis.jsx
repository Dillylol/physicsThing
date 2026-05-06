import React, { useMemo } from 'react';
import { CircleDot, AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';
import { minimumLoopHeight, speedAtLoopTop, normalForceAtLoopTop, OBJECT_PRESETS } from '../physics/inertia';
import { G } from '../physics/engine';

/**
 * Loop Analysis Panel — Directly maps to FRQ Problem 2.
 * Shows:
 * - Whether current setup can complete the loop
 * - Minimum release height calculation: h_min = R(5+b)/2
 * - Speed at top of loop
 * - Normal force at top (contact condition)
 * - FRQ2 experiment table: h vs b for different objects
 */
export default function LoopAnalysis({ track, inertiaData, setup, simState }) {
  const loopSegment = track?.segmentRanges?.find(s => s.type === 'loop');

  const analysis = useMemo(() => {
    if (!loopSegment || !track?.points?.length) return null;

    const loopStart = track.points[loopSegment.startIdx];
    const loopRadius = loopSegment.params.radius;
    const releaseHeight = track.points[0].y;
    const loopBottomHeight = loopStart.y;

    const effectiveH = releaseHeight - loopBottomHeight;
    const b = inertiaData.effectiveC;
    const hMin = minimumLoopHeight(loopRadius, b);
    const canComplete = effectiveH >= hMin;

    const vTop = speedAtLoopTop(effectiveH, loopRadius, b);
    const vMinTop = Math.sqrt(G * loopRadius);
    const nForceTop = normalForceAtLoopTop(inertiaData.totalMass, vTop, loopRadius);

    return {
      loopRadius,
      releaseHeight,
      loopBottomHeight,
      effectiveH,
      b,
      hMin,
      canComplete,
      vTop,
      vMinTop,
      nForceTop,
      margin: effectiveH - hMin,
    };
  }, [loopSegment, track, inertiaData]);

  const experimentData = useMemo(() => {
    if (!loopSegment) return null;
    const R = loopSegment.params.radius;
    return Object.entries(OBJECT_PRESETS)
      .filter(([_, p]) => !p.isCompound)
      .map(([key, preset]) => ({
        key,
        name: preset.name,
        b: preset.b,
        hMin: minimumLoopHeight(R, preset.b),
        hMinOverR: (5 + preset.b) / 2,
      }));
  }, [loopSegment]);

  if (!loopSegment) {
    return (
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center mb-3">
          <CircleDot className="w-5 h-5 mr-2 text-amber-400" /> Loop Analysis
        </h2>
        <p className="text-sm text-slate-500">
          Add a loop segment to the track to see FRQ2 analysis.
          Use the "Loop Track (FRQ 2)" preset.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/50">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center">
          <CircleDot className="w-5 h-5 mr-2 text-amber-400" /> Loop Analysis
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          FRQ 2: Minimum height to complete a loop without losing contact
        </p>
      </div>

      <div className="p-4 space-y-4">
        {analysis && (
          <>
            {/* Pass/Fail Indicator */}
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${
              analysis.canComplete
                ? 'bg-emerald-950/50 border-emerald-500/30'
                : 'bg-rose-950/50 border-rose-500/30'
            }`}>
              {analysis.canComplete
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              }
              <div>
                <div className={`text-sm font-semibold ${analysis.canComplete ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {analysis.canComplete ? 'Will complete the loop' : 'Will NOT complete the loop'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {analysis.canComplete
                    ? `Height margin: +${analysis.margin.toFixed(3)} m above minimum`
                    : `Need ${Math.abs(analysis.margin).toFixed(3)} m more height`
                  }
                </div>
              </div>
            </div>

            {/* Key Formula */}
            <div className="bg-slate-950 border border-amber-500/20 rounded-lg p-3">
              <div className="text-center font-mono text-sm text-amber-300 mb-2">
                h<sub>min</sub> = R(5 + b) / 2
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-900 rounded p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">Loop R</div>
                  <div className="font-mono text-amber-400">{analysis.loopRadius.toFixed(2)} m</div>
                </div>
                <div className="bg-slate-900 rounded p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">b = I/(mr²)</div>
                  <div className="font-mono text-cyan-400">{analysis.b.toFixed(4)}</div>
                </div>
                <div className="bg-slate-900 rounded p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">h<sub>min</sub></div>
                  <div className="font-mono text-rose-400">{analysis.hMin.toFixed(3)} m</div>
                </div>
                <div className="bg-slate-900 rounded p-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase">h<sub>actual</sub></div>
                  <div className={`font-mono ${analysis.canComplete ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {analysis.effectiveH.toFixed(3)} m
                  </div>
                </div>
              </div>
            </div>

            {/* Loop Top Physics */}
            <div className="bg-slate-950 border border-blue-500/20 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">At the Top of the Loop</h3>
              <div className="text-center font-mono text-[11px] text-slate-500 mb-2">
                N + mg = mv²/R → N = m(v²/R − g)
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">v<sub>min</sub> (at top)</span>
                  <span className="font-mono text-blue-300">√(gR) = {analysis.vMinTop.toFixed(3)} m/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">v<sub>actual</sub> (at top)</span>
                  <span className={`font-mono ${analysis.vTop >= analysis.vMinTop ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {analysis.vTop.toFixed(3)} m/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Normal force (top)</span>
                  <span className={`font-mono ${analysis.nForceTop >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {analysis.nForceTop.toFixed(3)} N
                  </span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-600">
                Contact condition: N ≥ 0 → v² ≥ gR
              </div>
            </div>

            {/* Derivation */}
            <div className="bg-slate-950 border border-fuchsia-500/20 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-fuchsia-400 uppercase tracking-wider mb-2">Energy Conservation Derivation</h3>
              <div className="space-y-1 text-[11px] font-mono text-slate-400">
                <div>mgh = ½mv²(1+b) + mg(2R)</div>
                <div className="text-slate-600">at minimum: v² = gR</div>
                <div>mgh<sub>min</sub> = ½m(gR)(1+b) + mg(2R)</div>
                <div>h<sub>min</sub> = R(1+b)/2 + 2R</div>
                <div className="text-amber-400 font-semibold">h<sub>min</sub> = R(5 + b) / 2</div>
              </div>
            </div>
          </>
        )}

        {/* FRQ2 Experiment Table */}
        {experimentData && (
          <div className="bg-slate-950 border border-emerald-500/20 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center">
              <FlaskConical className="w-3.5 h-3.5 mr-1" /> FRQ2 Experiment: h vs b
            </h3>
            <p className="text-[10px] text-slate-500 mb-2">
              Predicted minimum heights for R = {analysis?.loopRadius?.toFixed(1)} m loop
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-1 text-slate-500 font-medium">Object</th>
                    <th className="text-center py-1 text-slate-500 font-medium">b</th>
                    <th className="text-center py-1 text-slate-500 font-medium">h<sub>min</sub>/R</th>
                    <th className="text-right py-1 text-slate-500 font-medium">h<sub>min</sub> (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {experimentData.map(row => (
                    <tr key={row.key} className={`border-b border-slate-800/50 ${
                      row.b === analysis?.b ? 'bg-emerald-500/10' : ''
                    }`}>
                      <td className="py-1.5 text-slate-300">{row.name}</td>
                      <td className="py-1.5 text-center font-mono text-cyan-400">{row.b.toFixed(2)}</td>
                      <td className="py-1.5 text-center font-mono text-amber-400">{row.hMinOverR.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono text-slate-300">{row.hMin.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-slate-600 font-mono text-center">
              h<sub>min</sub> = R(5+b)/2 → linear in b, slope = R/2
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
