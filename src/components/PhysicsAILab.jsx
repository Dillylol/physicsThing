import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, Activity, Calculator, Waypoints, Zap, FastForward, BrainCircuit } from 'lucide-react';
import { buildInertiaFromSetup, SHAPES } from '../physics/inertia';
import { buildTrack, DEFAULT_SEGMENTS } from '../physics/trackBuilder';
import { stepSimulation, G } from '../physics/engine';
import Simulator from './Simulator';
import LabSetup from './LabSetup';
import TrackEditor from './TrackEditor';
import EquationsPanel from './EquationsPanel';
import AIAssistant from './AIAssistant';

/**
 * Main Physics Lab Application.
 * Orchestrates the setup, track, simulation, and equations panels.
 */
export default function PhysicsAILab() {
  // --- SETUP STATE ---
  const [setup, setSetup] = useState({
    shapeKey: 'solid_disk',
    mass: 5,
    radius: 0.5,
    friction: 0.8,
    showForces: true,
    isCompound: false,
    centerShape: 'solid_disk',
    centerMass: 2,
    centerRadius: 0.5,
    sideShape: 'hoop',
    sideMass: 1,
    sideRadius: 0.3,
    rollsOnInner: false,
  });

  // --- TRACK STATE ---
  const [segments, setSegments] = useState([...DEFAULT_SEGMENTS]);
  const [trackWidth, setTrackWidth] = useState('normal'); // 'normal' | 'thin'

  // --- SIMULATION STATE ---
  const [simState, setSimState] = useState({
    distance: 0, velocity: 0, omega: 0, thetaRot: 0,
    time: 0, PE: 0, KE_trans: 0, KE_rot: 0, totalEnergy: 0,
    angularMomentum: 0, linearMomentum: 0,
    isSlipping: false, acceleration: 0,
    x: 0, y: 0, tangentAngle: 0, segmentType: 'ramp', curvature: 0,
    finished: false,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'equations'
  const [hoverPhysics, setHoverPhysics] = useState(null);

  // Refs for animation
  const requestRef = useRef(null);
  const prevTimeRef = useRef(null);

  // --- COMPUTED DATA ---
  const inertiaData = useMemo(() => buildInertiaFromSetup(setup), [setup]);
  const trackThickness = trackWidth === 'thin' ? 0.1 : 0.3;
  const track = useMemo(() => buildTrack(segments, trackThickness), [segments, trackThickness]);

  // --- RESET ---
  const resetSim = useCallback(() => {
    setIsPlaying(false);
    prevTimeRef.current = null;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    const startPt = track.points[0];
    const h0 = startPt?.y || 0;
    const PE = inertiaData.totalMass * G * h0;

    setSimState({
      distance: 0, velocity: 0, omega: 0, thetaRot: 0,
      time: 0, PE, KE_trans: 0, KE_rot: 0, totalEnergy: PE,
      angularMomentum: 0, linearMomentum: 0,
      isSlipping: false, acceleration: 0,
      x: startPt?.x || 0, y: startPt?.y || 0,
      tangentAngle: startPt?.tangentAngle || 0,
      segmentType: startPt?.type || 'ramp', curvature: 0,
      finished: false,
    });
  }, [track, inertiaData]);

  // Reset when setup or track changes
  // Sync rollsOnInner with trackWidth
  useEffect(() => {
    setSetup(prev => ({ ...prev, rollsOnInner: trackWidth === 'thin' }));
  }, [trackWidth]);

  useEffect(() => { resetSim(); }, [setup, segments, trackWidth, resetSim]);

  // --- ANIMATION LOOP ---
  const animate = useCallback((timestamp) => {
    if (prevTimeRef.current !== null) {
      const rawDt = (timestamp - prevTimeRef.current) / 1000;
      const dt = Math.min(rawDt * simSpeed, 0.02); // cap to prevent instability

      setSimState((prev) => {
        if (prev.finished) {
          setIsPlaying(false);
          return prev;
        }

        const newState = stepSimulation(prev, dt, {
          totalMass: inertiaData.totalMass,
          totalInertia: inertiaData.totalInertia,
          effectiveC: inertiaData.effectiveC,
          rollRadius: inertiaData.rollRadius,
          friction: setup.friction,
          track,
        });

        if (newState.finished) {
          // Don't call setIsPlaying here to avoid React warning
          // Instead we'll detect finished state in the next frame
        }

        return newState;
      });
    }
    prevTimeRef.current = timestamp;
    requestRef.current = requestAnimationFrame(animate);
  }, [simSpeed, inertiaData, setup.friction, track]);

  useEffect(() => {
    if (isPlaying) {
      prevTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      prevTimeRef.current = null;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  // Stop when simulation finishes
  useEffect(() => {
    if (simState.finished && isPlaying) {
      setIsPlaying(false);
    }
  }, [simState.finished, isPlaying]);

  // --- CONTROLS ---
  const togglePlay = () => {
    if (simState.finished) resetSim();
    setIsPlaying(p => !p);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 via-emerald-400 to-fuchsia-400 bg-clip-text text-transparent">
              Rotational Physics Lab
            </h1>
            <p className="text-sm text-slate-500">
              Compound inertia systems · Custom tracks · Live force & energy analysis
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'simulator'
                  ? 'bg-slate-800 text-emerald-400 shadow-md'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Activity className="w-4 h-4 mr-1.5" /> Simulator
            </button>
            <button
              onClick={() => setActiveTab('equations')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'equations'
                  ? 'bg-slate-800 text-cyan-400 shadow-md'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Calculator className="w-4 h-4 mr-1.5" /> Equations
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'ai'
                  ? 'bg-slate-800 text-fuchsia-400 shadow-md'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <BrainCircuit className="w-4 h-4 mr-1.5" /> AI
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT PANEL: Lab Setup + Track Editor */}
          <div className="lg:col-span-3 space-y-5">
            <LabSetup setup={setup} onChange={setSetup} />
            <TrackEditor
              segments={segments}
              onSegmentsChange={setSegments}
              trackWidth={trackWidth}
              onWidthChange={setTrackWidth}
            />
          </div>

          {/* CENTER PANEL */}
          <div className="lg:col-span-6 space-y-5">
            {/* Viewport */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              {/* Controls */}
              <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-sm font-semibold flex items-center text-slate-300">
                  <Activity className="w-4 h-4 mr-2 text-emerald-400" /> Interactive Viewer
                </h2>
                <div className="flex items-center gap-2">
                  {/* Speed control */}
                  <div className="flex items-center gap-1 bg-slate-950 rounded-md px-2 py-1 border border-slate-800">
                    <FastForward className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={simSpeed}
                      onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                      className="bg-transparent text-xs text-slate-400 focus:outline-none"
                    >
                      <option value={0.25}>0.25×</option>
                      <option value={0.5}>0.5×</option>
                      <option value={1}>1×</option>
                      <option value={2}>2×</option>
                      <option value={4}>4×</option>
                    </select>
                  </div>

                  <div className="flex bg-slate-950 rounded-md p-1 border border-slate-800">
                    <button
                      onClick={togglePlay}
                      className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition-all ${
                        isPlaying
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
                      {isPlaying ? 'Pause' : simState.finished ? 'Restart' : 'Run'}
                    </button>
                    <button onClick={resetSim} className="flex items-center px-3 py-1.5 rounded text-sm font-medium text-slate-400 hover:text-slate-200 ml-1">
                      <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Canvas */}
              <div className="relative w-full h-[380px]">
                <Simulator
                  track={track}
                  simState={simState}
                  setup={setup}
                  inertiaData={inertiaData}
                  onHover={setHoverPhysics}
                  trackWidth={trackWidth}
                />
                {/* Overlay Status */}
                <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-lg pointer-events-none">
                  <div className="flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-400">Time:</span>
                      <span className="font-mono text-slate-200">{simState.time.toFixed(2)} s</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-400">Speed:</span>
                      <span className="font-mono text-emerald-400">{simState.velocity.toFixed(2)} m/s</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-400">ω:</span>
                      <span className="font-mono text-amber-400">{simState.omega.toFixed(2)} rad/s</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-400">L:</span>
                      <span className="font-mono text-fuchsia-400">{simState.angularMomentum?.toFixed(3) || '0'} kg·m²/s</span>
                    </div>
                    <div className={`mt-1 text-[11px] font-bold py-1 px-2 rounded flex items-center justify-center border ${
                      simState.isSlipping
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    }`}>
                      {simState.isSlipping ? '⚠ SLIDING' : '✓ PURE ROLLING'}
                    </div>
                  </div>
                </div>

                {/* Finished overlay */}
                {simState.finished && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-500/40 px-4 py-2 rounded-lg text-sm font-medium text-emerald-400 backdrop-blur">
                    ✓ Completed in {simState.time.toFixed(3)}s — Final v = {simState.velocity.toFixed(3)} m/s
                  </div>
                )}
              </div>

              {/* Live Energy Bar */}
              <div className="p-4 bg-slate-950 border-t border-slate-800">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
                  <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Energy Monitor
                </h3>
                <div className="text-center font-mono text-sm mb-2 text-slate-400">
                  E<sub>total</sub> = ½mv² + ½Iω² + mgh
                </div>
                <div className="flex items-center justify-center gap-x-2 flex-wrap font-mono text-sm">
                  <span className="text-slate-200 font-bold bg-slate-800 px-2 py-1 rounded">
                    {simState.totalEnergy.toFixed(1)} J
                  </span>
                  <span className="text-slate-500">=</span>
                  <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                    {simState.KE_trans.toFixed(1)} J
                  </span>
                  <span className="text-slate-500">+</span>
                  <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                    {simState.KE_rot.toFixed(1)} J
                  </span>
                  <span className="text-slate-500">+</span>
                  <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                    {simState.PE.toFixed(1)} J
                  </span>
                </div>

                {/* Visual energy bar */}
                <div className="mt-3 h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  {simState.totalEnergy > 0 && (
                    <>
                      <div className="bg-emerald-500 transition-all duration-100" style={{ width: `${(simState.KE_trans / simState.totalEnergy) * 100}%` }} title="KE translational" />
                      <div className="bg-amber-500 transition-all duration-100" style={{ width: `${(simState.KE_rot / simState.totalEnergy) * 100}%` }} title="KE rotational" />
                      <div className="bg-blue-500 transition-all duration-100" style={{ width: `${(simState.PE / simState.totalEnergy) * 100}%` }} title="Potential energy" />
                    </>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span className="text-emerald-500">½mv²</span>
                  <span className="text-amber-500">½Iω²</span>
                  <span className="text-blue-500">mgh</span>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT PANEL: Equations or AI */}
          <div className="lg:col-span-3">
            {activeTab === 'equations' ? (
              <EquationsPanel
                simState={simState}
                inertiaData={inertiaData}
                setup={setup}
                track={track}
              />
            ) : activeTab === 'ai' ? (
              <AIAssistant
                setup={setup}
                inertiaData={inertiaData}
                simState={simState}
                track={track}
              />
            ) : (
              /* Quick Summary Panel when on Simulator tab */
              <div className="space-y-5">
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                  <h2 className="text-lg font-semibold text-slate-100 flex items-center mb-4">
                    <Calculator className="w-5 h-5 mr-2 text-cyan-400" /> Quick Physics
                  </h2>

                  {/* Inertia Summary */}
                  <div className="space-y-3">
                    <div className="bg-slate-950 border border-blue-500/20 rounded-lg p-3">
                      <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Inertia</h3>
                      {inertiaData.parts.map((part, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-400">{part.name}</span>
                          <span className="font-mono text-blue-300">{part.I.toFixed(4)}</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-800 mt-2 pt-2 flex justify-between text-sm font-semibold">
                        <span className="text-slate-300">Total</span>
                        <span className="font-mono text-blue-400">{inertiaData.totalInertia.toFixed(4)} kg·m²</span>
                      </div>
                    </div>

                    {/* Live Values */}
                    <div className="bg-slate-950 border border-emerald-500/20 rounded-lg p-3 space-y-1.5">
                      <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Live Values</h3>
                      <QuickRow label="Total Mass" value={`${inertiaData.totalMass.toFixed(2)} kg`} />
                      <QuickRow label="Roll Radius" value={`${inertiaData.rollRadius.toFixed(3)} m`} />
                      <QuickRow label="c = I/(mR²)" value={inertiaData.effectiveC.toFixed(4)} />
                      <QuickRow label="Accel" value={`${(simState.acceleration || 0).toFixed(3)} m/s²`} />
                      <QuickRow label="Angular Mom." value={`${(simState.angularMomentum || 0).toFixed(4)} kg·m²/s`} />
                    </div>

                    {/* Torque */}
                    <div className="bg-slate-950 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
                      <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Torque</h3>
                      <div className="text-center font-mono text-xs text-slate-500 mb-1">τ = Iα = FR</div>
                      <QuickRow label="τ" value={`${(inertiaData.totalInertia * (simState.acceleration || 0) / inertiaData.rollRadius).toFixed(4)} N·m`} />
                    </div>
                  </div>
                </section>

                {/* Hover info panel */}
                {hoverPhysics && (
                  <section className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 shadow-lg animate-fadeIn">
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                      📍 Hover Point Analysis
                    </h3>
                    <div className="space-y-1 text-sm">
                      <QuickRow label="Height" value={`${hoverPhysics.height.toFixed(2)} m`} />
                      <QuickRow label="Speed" value={`${hoverPhysics.velocity.toFixed(2)} m/s`} />
                      <QuickRow label="ω" value={`${hoverPhysics.omega.toFixed(2)} rad/s`} />
                      <QuickRow label="PE" value={`${hoverPhysics.PE.toFixed(1)} J`} />
                      <QuickRow label="½mv²" value={`${hoverPhysics.KE_trans.toFixed(1)} J`} />
                      <QuickRow label="½Iω²" value={`${hoverPhysics.KE_rot.toFixed(1)} J`} />
                      <QuickRow label="Total E" value={`${hoverPhysics.totalEnergy.toFixed(1)} J`} />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function QuickRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-300">{value}</span>
    </div>
  );
}
