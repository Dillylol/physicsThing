import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { computePhysicsAt } from '../physics/engine';

/**
 * 3D Three.js simulator with:
 * - Track rendered as 3D geometry
 * - Rolling object (compound or single)
 * - Force arrows
 * - Mouse hover energy tooltips (HTML overlay)
 */
export default function Simulator({ track, simState, setup, inertiaData, onHover, trackWidth }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const camState = useRef({ isDragging: false, prevX: 0, prevY: 0, theta: Math.PI / 4, phi: Math.PI / 3, distance: 25 });
  const [tooltip, setTooltip] = useState(null);

  // Compute camera target from track bounds
  const trackCenter = useMemo(() => {
    if (!track?.points?.length) return { x: 7, y: 4, z: 0 };
    let mx = 0, my = 0;
    for (const p of track.points) { mx += p.x; my += p.y; }
    return { x: mx / track.points.length, y: my / track.points.length, z: 0 };
  }, [track]);

  // --- THREE.JS SCENE INIT ---
  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    const w = el.clientWidth, h = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);
    scene.fog = new THREE.Fog(0x0a0f1e, 40, 80);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(15, 25, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0x3b82f6, 0.3);
    rim.position.set(-10, 5, -10);
    scene.add(rim);

    // Grid
    const grid = new THREE.GridHelper(60, 60, 0x1e293b, 0x111827);
    grid.position.y = -0.5;
    scene.add(grid);

    // Groups
    const trackGroup = new THREE.Group();
    const objGroup = new THREE.Group();
    const arrowGroup = new THREE.Group();
    scene.add(trackGroup);
    scene.add(objGroup);
    scene.add(arrowGroup);

    sceneRef.current = { scene, camera, renderer, trackGroup, objGroup, arrowGroup };

    // Camera orbit
    const onMouseDown = (e) => {
      camState.current.isDragging = true;
      camState.current.prevX = e.clientX;
      camState.current.prevY = e.clientY;
    };
    const onMouseUp = () => { camState.current.isDragging = false; };
    const onMouseMove = (e) => {
      if (!camState.current.isDragging) return;
      // Reversed left/right: += instead of -=
      camState.current.theta += (e.clientX - camState.current.prevX) * 0.008;
      camState.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1,
        camState.current.phi - (e.clientY - camState.current.prevY) * 0.008));
      camState.current.prevX = e.clientX;
      camState.current.prevY = e.clientY;
    };
    const onWheel = (e) => {
      camState.current.distance = Math.max(5, Math.min(60, camState.current.distance + e.deltaY * 0.02));
    };
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    el.addEventListener('wheel', onWheel, { passive: true });

    // Resize
    const onResize = () => {
      if (!el) return;
      const nw = el.clientWidth, nh = el.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // --- BUILD TRACK GEOMETRY ---
  useEffect(() => {
    const { trackGroup } = sceneRef.current;
    if (!trackGroup || !track?.points?.length) return;

    // Clear old
    while (trackGroup.children.length) {
      const c = trackGroup.children[0];
      trackGroup.remove(c);
      c.geometry?.dispose();
      c.material?.dispose();
    }

    const pts = track.points;
    const thickness = track.rampThickness || 0.3;
    const halfW = trackWidth === 'thin' ? 0.5 : 2; // half-width in Z

    // Build track as extruded shape along the path
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x334155, roughness: 0.6, metalness: 0.2,
      side: THREE.DoubleSide,
    });
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x475569, roughness: 0.4, metalness: 0.3,
    });

    // Create top surface as a ribbon
    const surfaceVerts = [];
    const surfaceIdxs = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      surfaceVerts.push(p.x, p.y, -halfW);
      surfaceVerts.push(p.x, p.y, halfW);
      if (i < pts.length - 1) {
        const base = i * 2;
        surfaceIdxs.push(base, base + 1, base + 2);
        surfaceIdxs.push(base + 1, base + 3, base + 2);
      }
    }
    const surfaceGeo = new THREE.BufferGeometry();
    surfaceGeo.setAttribute('position', new THREE.Float32BufferAttribute(surfaceVerts, 3));
    surfaceGeo.setIndex(surfaceIdxs);
    surfaceGeo.computeVertexNormals();
    const surfMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfMesh.receiveShadow = true;
    trackGroup.add(surfMesh);

    // Bottom thickness
    const bottomVerts = [];
    const bottomIdxs = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      bottomVerts.push(p.x, p.y - thickness, -halfW);
      bottomVerts.push(p.x, p.y - thickness, halfW);
      if (i < pts.length - 1) {
        const base = i * 2;
        bottomIdxs.push(base, base + 2, base + 1);
        bottomIdxs.push(base + 1, base + 2, base + 3);
      }
    }
    const bottomGeo = new THREE.BufferGeometry();
    bottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(bottomVerts, 3));
    bottomGeo.setIndex(bottomIdxs);
    bottomGeo.computeVertexNormals();
    trackGroup.add(new THREE.Mesh(bottomGeo, trackMat));

    // Side walls
    for (const zOff of [-halfW, halfW]) {
      const sideVerts = [];
      const sideIdxs = [];
      for (let i = 0; i < pts.length; i++) {
        sideVerts.push(pts[i].x, pts[i].y, zOff);
        sideVerts.push(pts[i].x, pts[i].y - thickness, zOff);
        if (i < pts.length - 1) {
          const base = i * 2;
          if (zOff < 0) {
            sideIdxs.push(base, base + 2, base + 1);
            sideIdxs.push(base + 1, base + 2, base + 3);
          } else {
            sideIdxs.push(base, base + 1, base + 2);
            sideIdxs.push(base + 1, base + 3, base + 2);
          }
        }
      }
      const sideGeo = new THREE.BufferGeometry();
      sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sideVerts, 3));
      sideGeo.setIndex(sideIdxs);
      sideGeo.computeVertexNormals();
      trackGroup.add(new THREE.Mesh(sideGeo, trackMat));
    }

    // Glowing edge line on top surface
    const edgePoints = pts.map(p => new THREE.Vector3(p.x, p.y + 0.02, 0));
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
    trackGroup.add(new THREE.Line(edgeGeo, edgeMat));

    // Segment markers (small spheres at boundaries)
    for (const seg of track.segmentRanges) {
      const pt = pts[seg.startIdx];
      const markerGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const markerColor = seg.type === 'loop' ? 0xf59e0b : seg.type === 'ramp' ? 0x3b82f6 : seg.type === 'rampUp' ? 0x10b981 : 0x64748b;
      const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: markerColor }));
      marker.position.set(pt.x, pt.y + 0.2, 0);
      trackGroup.add(marker);
    }

    // Support pillars at ends and every few meters
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 8))) {
      const p = pts[i];
      if (p.y > 0.5) {
        const pillarH = p.y - thickness;
        if (pillarH > 0.1) {
          const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, pillarH, 0.3),
            pillarMat
          );
          pillar.position.set(p.x, (p.y - thickness) / 2, 0);
          trackGroup.add(pillar);
        }
      }
    }
  }, [track, trackWidth]);

  // --- BUILD/UPDATE OBJECT MESH ---
  useEffect(() => {
    const { objGroup } = sceneRef.current;
    if (!objGroup) return;

    while (objGroup.children.length) {
      const c = objGroup.children[0];
      objGroup.remove(c);
      c.geometry?.dispose();
      c.material?.dispose();
    }

    const R = inertiaData.rollRadius;

    if (inertiaData.isCompound) {
      const centerR = setup.centerRadius || 0.5;
      const sideR = setup.sideRadius || 0.3;
      const isYoyo = sideR < centerR;
      const maxR = Math.max(centerR, sideR);
      const sideThickness = 0.3;
      const centerThickness = 0.6;
      // Z offset: sides sit on each side of the center
      const sideZ = centerThickness / 2 + sideThickness / 2;

      // Center object (fuchsia/blue)
      if (setup.centerShape === 'hoop') {
        const centerMesh = new THREE.Mesh(
          new THREE.TorusGeometry(centerR, Math.min(0.12, centerR * 0.25), 16, 48),
          new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3, metalness: 0.5 })
        );
        objGroup.add(centerMesh);
      } else {
        const centerMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(centerR, centerR, centerThickness, 32).rotateX(Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3, metalness: 0.4 })
        );
        objGroup.add(centerMesh);
      }

      // Side objects (amber) — two copies at +Z and -Z
      for (const zSign of [-1, 1]) {
        if (setup.sideShape === 'hoop') {
          const sideMesh = new THREE.Mesh(
            new THREE.TorusGeometry(sideR, Math.min(0.08, sideR * 0.25), 12, 40),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.5 })
          );
          sideMesh.position.z = zSign * sideZ;
          objGroup.add(sideMesh);
        } else {
          const sideMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(sideR, sideR, sideThickness, 32).rotateX(Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.4 })
          );
          sideMesh.position.z = zSign * sideZ;
          objGroup.add(sideMesh);
        }
      }

      // Axle connecting all three parts
      const axleLen = 2 * sideZ + sideThickness;
      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, axleLen, 8).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
      );
      objGroup.add(axle);
    } else {
      // Single object
      const shapeKey = setup.shapeKey;
      let geom, color, wireframe = false, transparent = false, opacity = 1;

      switch (shapeKey) {
        case 'hoop':
          geom = new THREE.TorusGeometry(R, Math.min(0.2, R * 0.3), 16, 64);
          color = 0xef4444;
          wireframe = true; transparent = true; opacity = 0.6;
          break;
        case 'solid_hoop':
          geom = new THREE.TorusGeometry(R, Math.min(0.25, R * 0.35), 24, 64);
          color = 0xf97316;
          break;
        case 'solid_sphere':
          geom = new THREE.SphereGeometry(R, 32, 32);
          color = 0x10b981;
          break;
        case 'hollow_sphere':
          geom = new THREE.SphereGeometry(R, 32, 32);
          color = 0xf59e0b;
          wireframe = true; transparent = true; opacity = 0.4;
          break;
        case 'solid_disk':
        default:
          geom = new THREE.CylinderGeometry(R, R, 2, 32).rotateX(Math.PI / 2);
          color = 0x3b82f6;
          break;
      }

      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.3, metalness: 0.4,
        wireframe, transparent, opacity,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      objGroup.add(mesh);
    }

    // Rotation indicator (white line)
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(R * 2.1, R * 0.15, R * 0.15),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    indicator.name = 'rotIndicator';
    objGroup.add(indicator);
  }, [setup.shapeKey, setup.isCompound, setup.centerShape, setup.sideShape,
      setup.centerRadius, setup.sideRadius, inertiaData.rollRadius, inertiaData.isCompound]);

  // --- BUILD FORCE ARROWS ---
  useEffect(() => {
    const { arrowGroup, scene } = sceneRef.current;
    if (!arrowGroup) return;
    while (arrowGroup.children.length) {
      const c = arrowGroup.children[0];
      arrowGroup.remove(c);
    }

    const origin = new THREE.Vector3();
    const arrows = {};
    arrows.gravity = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), origin, 1, 0xa855f7, 0.3, 0.15);
    arrows.normal = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 1, 0x38bdf8, 0.3, 0.15);
    arrows.friction = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), origin, 1, 0xf43f5e, 0.3, 0.15);
    arrows.centripetal = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 1, 0xf59e0b, 0.3, 0.15);
    arrows.centripetal.visible = false;

    for (const a of Object.values(arrows)) arrowGroup.add(a);
    sceneRef.current.arrows = arrows;
  }, []);

  // --- RENDER LOOP (runs every frame) ---
  useEffect(() => {
    const { scene, camera, renderer, objGroup, arrowGroup, arrows } = sceneRef.current;
    if (!scene || !renderer || !track?.points?.length) return;

    let animId;
    const renderLoop = () => {
      // Update camera position
      const { theta, phi, distance } = camState.current;
      const target = new THREE.Vector3(trackCenter.x, trackCenter.y, 0);
      camera.position.set(
        target.x + distance * Math.sin(phi) * Math.cos(theta),
        target.y + distance * Math.cos(phi),
        target.z + distance * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);

      // Position object
      if (objGroup && simState) {
        const pts = track.points;
        const d = simState.distance || 0;
        const pos = getInterpolatedPos(pts, d, track.totalLength);
        const R = inertiaData.rollRadius;
        const tangent = pos.tangentAngle || 0;
        const normalAngle = tangent + Math.PI / 2;

        const cx = pos.x + R * Math.cos(normalAngle);
        const cy = pos.y + R * Math.sin(normalAngle);

        objGroup.position.set(cx, cy, 0);
        objGroup.rotation.z = -(simState.thetaRot || 0);

        // Update force arrows
        if (arrows && setup.showForces) {
          const initialH = pts[0].y;
          const physics = computePhysicsAt({
            totalMass: inertiaData.totalMass,
            totalInertia: inertiaData.totalInertia,
            effectiveC: inertiaData.effectiveC,
            rollRadius: inertiaData.rollRadius,
            friction: setup.friction,
            track, distance: d, initialHeight: initialH,
          });

          const contactX = pos.x;
          const contactY = pos.y;
          const arrowScale = 0.04;

          // Gravity
          arrows.gravity.position.set(cx, cy, 0);
          arrows.gravity.setLength(Math.max(0.2, physics.F_gravity * arrowScale), 0.3, 0.15);
          arrows.gravity.visible = true;

          // Normal
          arrows.normal.position.set(contactX, contactY, 0);
          arrows.normal.setDirection(new THREE.Vector3(Math.cos(normalAngle), Math.sin(normalAngle), 0));
          arrows.normal.setLength(Math.max(0.2, physics.F_normal * arrowScale), 0.3, 0.15);
          arrows.normal.visible = true;

          // Friction (opposes motion along surface)
          const frDir = tangent + Math.PI;
          arrows.friction.position.set(contactX, contactY, 0);
          arrows.friction.setDirection(new THREE.Vector3(Math.cos(frDir), Math.sin(frDir), 0));
          arrows.friction.setLength(Math.max(0.1, physics.F_friction * arrowScale), 0.2, 0.1);
          arrows.friction.visible = true;

          // Centripetal
          if (physics.F_centripetal > 0.01) {
            arrows.centripetal.position.set(cx, cy, 0);
            arrows.centripetal.setDirection(new THREE.Vector3(-Math.cos(normalAngle), -Math.sin(normalAngle), 0));
            arrows.centripetal.setLength(Math.max(0.2, physics.F_centripetal * arrowScale), 0.3, 0.15);
            arrows.centripetal.visible = true;
          } else {
            arrows.centripetal.visible = false;
          }
        } else if (arrows) {
          for (const a of Object.values(arrows)) a.visible = false;
        }
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };
    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [track, simState, setup.showForces, setup.friction, inertiaData, trackCenter]);

  // --- MOUSE HOVER FOR ENERGY TOOLTIPS ---
  const handleMouseMove = useCallback((e) => {
    if (!track?.points?.length || !sceneRef.current.camera || !sceneRef.current.renderer) return;
    const rect = mountRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const { camera } = sceneRef.current;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

    // Create a plane at z=0 to find intersection
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    if (!intersection) { setTooltip(null); onHover?.(null); return; }

    // Find closest track point
    let bestDist = Infinity, bestIdx = 0;
    for (let i = 0; i < track.points.length; i++) {
      const p = track.points[i];
      const dx = p.x - intersection.x, dy = p.y - intersection.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (Math.sqrt(bestDist) < 2) {
      const pt = track.points[bestIdx];
      const initialHeight = track.points[0].y;
      const physics = computePhysicsAt({
        totalMass: inertiaData.totalMass,
        totalInertia: inertiaData.totalInertia,
        effectiveC: inertiaData.effectiveC,
        rollRadius: inertiaData.rollRadius,
        friction: setup.friction,
        track, distance: pt.cumDist, initialHeight,
      });

      setTooltip({
        left: e.clientX - mountRef.current.getBoundingClientRect().left + 15,
        top: e.clientY - mountRef.current.getBoundingClientRect().top - 10,
        physics,
      });
      onHover?.(physics);
    } else {
      setTooltip(null);
      onHover?.(null);
    }
  }, [track, inertiaData, setup.friction, onHover]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 320 }}>
      <div
        ref={mountRef}
        className="w-full h-full cursor-move"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); onHover?.(null); }}
      />
      {/* HTML Hover Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-900/95 backdrop-blur border border-amber-500/40 rounded-lg p-3 shadow-xl text-xs font-mono"
          style={{ left: tooltip.left, top: tooltip.top, minWidth: 170 }}
        >
          <div className="text-amber-400 font-semibold mb-1.5 text-[10px] uppercase tracking-wider">Energy at Point</div>
          <Row label="Height" val={`${tooltip.physics.height.toFixed(2)} m`} c="text-slate-300" />
          <Row label="Speed" val={`${tooltip.physics.velocity.toFixed(2)} m/s`} c="text-emerald-400" />
          <Row label="ω" val={`${tooltip.physics.omega.toFixed(2)} rad/s`} c="text-amber-300" />
          <Row label="PE" val={`${tooltip.physics.PE.toFixed(1)} J`} c="text-blue-400" />
          <Row label="½mv²" val={`${tooltip.physics.KE_trans.toFixed(1)} J`} c="text-emerald-400" />
          <Row label="½Iω²" val={`${tooltip.physics.KE_rot.toFixed(1)} J`} c="text-amber-400" />
          <div className="border-t border-slate-700 mt-1 pt-1">
            <Row label="Total E" val={`${tooltip.physics.totalEnergy.toFixed(1)} J`} c="text-white font-bold" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, val, c }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={c}>{val}</span>
    </div>
  );
}

// Helper: interpolate position along track
function getInterpolatedPos(pts, dist, totalLength) {
  if (dist <= 0) return pts[0];
  if (dist >= totalLength) return pts[pts.length - 1];
  let lo = 0, hi = pts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].cumDist <= dist) lo = mid; else hi = mid;
  }
  const p0 = pts[lo], p1 = pts[hi];
  const segLen = p1.cumDist - p0.cumDist;
  const t = segLen > 0 ? (dist - p0.cumDist) / segLen : 0;
  return {
    x: p0.x + t * (p1.x - p0.x),
    y: p0.y + t * (p1.y - p0.y),
    tangentAngle: (p0.tangentAngle || 0) + t * ((p1.tangentAngle || 0) - (p0.tangentAngle || 0)),
    type: p0.type,
    curvature: p0.curvature || 0,
  };
}
