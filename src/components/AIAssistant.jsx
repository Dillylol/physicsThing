import React, { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, Database, Timer, Activity } from 'lucide-react';
import { SHAPES } from '../physics/inertia';

const G = 9.81;
const RAMP_LENGTH = 15;

/**
 * AI Prediction Assistant — KNN-based predictor that learns from
 * simulated experiments and predicts outcomes for new configurations.
 */
export default function AIAssistant({ setup, inertiaData, simState, track }) {
  const [aiMemory, setAiMemory] = useState([]);
  const [aiPrediction, setAiPrediction] = useState({ time: null, velocity: null, slip: null, efficiency: null, confidence: 0 });
  const [aiError, setAiError] = useState({ time: null });
  const [isTraining, setIsTraining] = useState(false);

  // --- PHYSICS ENGINE (for training data generation) ---
  const calculateFinalOutcomes = useCallback((m, r, ang, frict, shapeC) => {
    const angleRad = (ang * Math.PI) / 180;
    const muCrit = (shapeC / (1 + shapeC)) * Math.tan(angleRad);
    const isSlipping = frict < muCrit;

    let a;
    if (isSlipping) {
      a = G * (Math.sin(angleRad) - frict * Math.cos(angleRad));
    } else {
      a = (G * Math.sin(angleRad)) / (1 + shapeC);
    }
    a = Math.max(0.001, a);

    const trackLen = track?.totalLength || RAMP_LENGTH;
    const finalTime = Math.sqrt((2 * trackLen) / a);
    const initialHeight = track?.points?.[0]?.y || (trackLen * Math.sin(angleRad));
    const initialEnergy = m * G * initialHeight;
    const finalVelocity = a * finalTime;

    let alpha = isSlipping ? (frict * G * Math.cos(angleRad)) / (shapeC * r) : a / r;
    const finalOmega = alpha * finalTime;

    const finalKeTrans = 0.5 * m * finalVelocity * finalVelocity;
    const finalKeRot = 0.5 * (shapeC * m * r * r) * finalOmega * finalOmega;
    const finalMechEnergy = finalKeTrans + finalKeRot;
    const efficiency = initialEnergy > 0 ? finalMechEnergy / initialEnergy : 1;

    return { finalTime, finalVelocity, finalOmega, isSlipping, initialEnergy, efficiency };
  }, [track]);

  // --- TRAIN AI ---
  const trainAI = () => {
    setIsTraining(true);
    setTimeout(() => {
      const memory = [];
      const shapeKeys = Object.keys(SHAPES);
      const mSteps = [1, 5, 10, 15, 20];
      const rSteps = [0.5, 1.0, 1.5, 2.0];
      const angSteps = [5, 15, 25, 35, 45, 55];
      const fSteps = [0.0, 0.25, 0.5, 0.75, 1.0];

      for (const m of mSteps) {
        for (const ang of angSteps) {
          for (const frict of fSteps) {
            for (const shape of shapeKeys) {
              const r = rSteps[Math.floor(Math.random() * rSteps.length)];
              const c = SHAPES[shape].c;
              const outcomes = calculateFinalOutcomes(m, r, ang, frict, c);
              memory.push({ conditions: [m, r, ang, frict, c], outcomes });
            }
          }
        }
      }
      // Random noise samples
      for (let i = 0; i < 500; i++) {
        const m = Math.random() * 19 + 1;
        const r = Math.random() * 1.5 + 0.5;
        const ang = Math.random() * 55 + 5;
        const frict = Math.random();
        const shape = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
        const c = SHAPES[shape].c;
        const outcomes = calculateFinalOutcomes(m, r, ang, frict, c);
        memory.push({ conditions: [m, r, ang, frict, c], outcomes });
      }
      setAiMemory(memory);
      setIsTraining(false);
    }, 600);
  };

  // --- UPDATE PREDICTIONS ---
  const updatePredictions = useCallback(() => {
    if (aiMemory.length === 0) return;

    const c = inertiaData.effectiveC;
    const m = inertiaData.totalMass;
    const r = inertiaData.rollRadius;

    // Estimate ramp angle from first segment
    const firstSeg = track?.segmentRanges?.[0];
    const ang = firstSeg?.params?.angleDeg || 30;
    const frict = setup.friction;

    const bounds = [{ min: 1, max: 20 }, { min: 0.5, max: 2 }, { min: 5, max: 60 }, { min: 0, max: 1 }, { min: 0.4, max: 1.0 }];
    const featureWeights = [0.6, 0.8, 1.5, 1.2, 1.4];
    const currentConditions = [m, r, ang, frict, c];

    const normalize = (val, i) => (val - bounds[i].min) / (bounds[i].max - bounds[i].min);
    const normCurrent = currentConditions.map(normalize);

    const similarities = aiMemory.map(exp => {
      const normExp = exp.conditions.map(normalize);
      const dist = Math.sqrt(normCurrent.reduce((sum, val, i) => sum + featureWeights[i] * Math.pow(val - normExp[i], 2), 0));
      return { dist, outcomes: exp.outcomes };
    });

    similarities.sort((a, b) => a.dist - b.dist);
    const K = 12;
    const topK = similarities.slice(0, K);

    const bandwidth = Math.max(0.01, topK[K - 1].dist * 0.5);
    const weights = topK.map(s => Math.exp(-(s.dist * s.dist) / (2 * bandwidth * bandwidth)));
    const wSum = weights.reduce((a, b) => a + b, 0);
    const w = weights.map(v => v / wSum);

    const avgTime = topK.reduce((sum, s, i) => sum + w[i] * s.outcomes.finalTime, 0);
    const avgVel = topK.reduce((sum, s, i) => sum + w[i] * s.outcomes.finalVelocity, 0);
    const avgEff = topK.reduce((sum, s, i) => sum + w[i] * s.outcomes.efficiency, 0);
    const slipVotes = topK.reduce((sum, s, i) => sum + w[i] * (s.outcomes.isSlipping ? 1 : 0), 0);

    const avgDist = topK.reduce((s, x) => s + x.dist, 0) / K;
    const confidence = Math.min(1, Math.max(0, 1 - avgDist / 1.5));

    setAiPrediction({ time: avgTime, velocity: avgVel, slip: slipVotes > 0.5, efficiency: avgEff, confidence });
    setAiError({ time: null });
  }, [setup, aiMemory, inertiaData, track]);

  useEffect(() => { updatePredictions(); }, [setup, updatePredictions]);

  // Calculate error when sim finishes
  useEffect(() => {
    if (simState.finished && aiPrediction.time && simState.time > 0) {
      setAiError({
        time: Math.abs((aiPrediction.time - simState.time) / simState.time) * 100
      });
    }
  }, [simState.finished, simState.time, aiPrediction.time]);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center">
          <BrainCircuit className="w-5 h-5 mr-2 text-fuchsia-400" /> AI Assistant
        </h2>
        <div className="text-[10px] uppercase tracking-widest font-bold bg-slate-800 px-2 py-1 rounded text-slate-400 flex items-center">
          <Database className="w-3 h-3 mr-1" /> {aiMemory.length} Memories
        </div>
      </div>

      {aiMemory.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-800 rounded-lg">
          <Database className="w-8 h-8 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 mb-2">No Data Available</h3>
          <p className="text-xs text-slate-500 mb-4">The AI needs historical data to make predictions. Run automated background experiments to build its memory.</p>
          <button onClick={trainAI} disabled={isTraining} className="w-full py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center">
            {isTraining ? 'Running Simulations...' : 'Train AI Assistant'}
          </button>
        </div>
      ) : (
        <div className="flex-grow flex flex-col space-y-3">
          {/* Confidence Bar */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Confidence</span>
              <span className={`font-mono text-xs font-bold ${aiPrediction.confidence > 0.8 ? 'text-emerald-400' : aiPrediction.confidence > 0.5 ? 'text-amber-400' : 'text-rose-400'}`}>{(aiPrediction.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${aiPrediction.confidence > 0.8 ? 'bg-emerald-500' : aiPrediction.confidence > 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${aiPrediction.confidence * 100}%` }} />
            </div>
          </div>

          {/* Predictions */}
          <div className="bg-slate-950 border border-fuchsia-500/30 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-semibold text-fuchsia-400 uppercase tracking-wider">Predictions</h3>
            <PredRow icon={<Timer className="w-4 h-4 mr-2 text-slate-500" />} label="Time" value={aiPrediction.time ? `${aiPrediction.time.toFixed(2)}s` : '...'} color="text-fuchsia-300" />
            <PredRow icon={<Activity className="w-4 h-4 mr-2 text-slate-500" />} label="Velocity" value={aiPrediction.velocity ? `${aiPrediction.velocity.toFixed(1)} m/s` : '...'} color="text-emerald-300" />
            <PredRow label="Efficiency" value={aiPrediction.efficiency != null ? `${(aiPrediction.efficiency * 100).toFixed(0)}%` : '...'} color="text-amber-300" />
            <div className="flex justify-between items-center bg-slate-900 p-2 rounded">
              <span className="text-sm text-slate-300">Slip?</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${aiPrediction.slip ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{aiPrediction.slip == null ? '...' : aiPrediction.slip ? 'YES' : 'NO'}</span>
            </div>
          </div>

          {/* Results */}
          <div className={`border rounded-lg p-3 transition-all duration-500 ${simState.finished ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900 border-slate-800'}`}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${simState.finished ? 'text-emerald-400' : 'text-slate-500'}`}>
              {simState.finished ? 'Results' : 'Awaiting Run...'}
            </h3>
            <div className="space-y-2 opacity-90">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Actual Time:</span>
                <span className="font-mono text-slate-200">{simState.finished ? `${simState.time.toFixed(2)}s` : '--'}</span>
              </div>
            </div>
            {aiError.time !== null && (
              <div className="mt-3 pt-3 border-t border-emerald-500/20 text-center">
                <div className="bg-slate-950 rounded p-1.5 inline-block px-4">
                  <div className="text-[10px] text-slate-500 uppercase">Error Margin</div>
                  <div className={`font-mono text-xs ${aiError.time < 5 ? 'text-emerald-400' : 'text-amber-400'}`}>±{aiError.time.toFixed(1)}%</div>
                </div>
              </div>
            )}
          </div>

          {/* Retrain */}
          <button onClick={trainAI} disabled={isTraining} className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700">
            {isTraining ? 'Retraining...' : 'Retrain'}
          </button>
        </div>
      )}
    </section>
  );
}

function PredRow({ icon, label, value, color }) {
  return (
    <div className="flex justify-between items-center bg-slate-900 p-2 rounded">
      <span className="text-sm text-slate-300 flex items-center">{icon}{label}</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}
