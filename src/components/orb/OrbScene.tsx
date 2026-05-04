import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import {
  AdditiveBlending,
  Color,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  Vector3,
  type BufferGeometry,
  type Mesh,
  type Points,
} from 'three';
import { createNoise3D } from 'simplex-noise';
import type { OrbConfig, OrbGeometryPreset } from '../../types';
import type { OrbSeed } from './useOrbSeed';

interface Props {
  palette: string[];
  seed: OrbSeed;
  /** Per-slide admin overrides. Any field undefined falls back to the seed. */
  config?: OrbConfig;
  /** Set true when capturing a frame for download. R3F renders on-demand by
   *  default, but `preserveDrawingBuffer` is needed for `toDataURL` to work. */
  onCanvasCreated?: (canvas: HTMLCanvasElement) => void;
}

/** Each preset packages a base polyhedron, subdivision detail, and a noise
 *  multiplier so the dropdown choice gives a coherent silhouette without
 *  needing the admin to fiddle with sliders. The noiseMul scales the
 *  seed-derived noiseAmplitude (0 = no displacement, 1 = default, >1 = extra). */
type PresetSpec = {
  geom: 'ico' | 'dodec' | 'octa';
  detail: number;
  noiseMul: number;
};
const GEOMETRY_PRESETS: Record<OrbGeometryPreset, PresetSpec> = {
  classic: { geom: 'ico', detail: 3, noiseMul: 1.0 },
  gem: { geom: 'octa', detail: 4, noiseMul: 1.0 },
  rose: { geom: 'dodec', detail: 2, noiseMul: 1.0 },
  diamond: { geom: 'octa', detail: 1, noiseMul: 0.0 },
  crystal: { geom: 'ico', detail: 1, noiseMul: 1.5 },
  smooth: { geom: 'ico', detail: 4, noiseMul: 0.3 },
};

/** Tiny seeded PRNG (Mulberry32). simplex-noise v4 needs a `() => [0,1)` source
 *  to produce deterministic noise — we feed it one derived from the colleague seed
 *  so the same name always produces the same orb shape. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the polyhedron for a given preset spec. */
function buildBaseGeometry(spec: PresetSpec): BufferGeometry {
  switch (spec.geom) {
    case 'dodec':
      return new DodecahedronGeometry(1, spec.detail);
    case 'octa':
      return new OctahedronGeometry(1, spec.detail);
    case 'ico':
    default:
      return new IcosahedronGeometry(1, spec.detail);
  }
}

/** Builds the resolved polyhedron with per-vertex simplex-noise displacement.
 *  Resolution: preset = config.geometry || seed.geometryPreset, then noise
 *  amount = (config.noiseAmplitude || seed.noiseAmplitude) * preset.noiseMul. */
function useDisplacedGeometry(seed: OrbSeed, config: OrbConfig | undefined): BufferGeometry {
  const preset: OrbGeometryPreset = config?.geometry ?? seed.geometryPreset;
  const noiseScale = config?.noiseScale ?? seed.noiseScale;
  const noiseAmpBase = config?.noiseAmplitude ?? seed.noiseAmplitude;

  return useMemo(() => {
    const spec = GEOMETRY_PRESETS[preset];
    const geo = buildBaseGeometry(spec);
    const effectiveAmp = noiseAmpBase * spec.noiseMul;
    if (effectiveAmp > 0) {
      const noise3D = createNoise3D(mulberry32(seed.raw));
      const positions = geo.attributes.position;
      const v = new Vector3();
      for (let i = 0; i < positions.count; i++) {
        v.fromBufferAttribute(positions, i);
        const n = noise3D(v.x * noiseScale, v.y * noiseScale, v.z * noiseScale);
        const factor = 1 + n * effectiveAmp;
        v.multiplyScalar(factor);
        positions.setXYZ(i, v.x, v.y, v.z);
      }
      positions.needsUpdate = true;
    }
    geo.computeVertexNormals();
    return geo;
  }, [seed.raw, noiseScale, noiseAmpBase, preset]);
}

/** A drifting cloud of color-matched motes around the orb. Particles sit in a
 *  spherical shell (radius 1.5..3.0) so they read as "around" the orb without
 *  intersecting its silhouette. Colors are sampled from the palette for cohesion
 *  with the orb itself. The whole cloud rotates very slowly on a tilted axis to
 *  add depth without distracting from the centerpiece. */
const DEFAULT_PARTICLE_COUNT = 2500;

function ParticleField({
  palette,
  seed,
  count,
}: {
  palette: string[];
  seed: OrbSeed;
  count: number;
}) {
  const pointsRef = useRef<Points>(null);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    // Offset the seed so particle distribution doesn't correlate with the
    // displacement noise (which would create visible alignments).
    const rng = mulberry32(seed.raw ^ 0x9e3779b9);
    const colorObjs = (palette.length > 0 ? palette : ['#ffffff']).map(
      (hex) => new Color(hex),
    );

    for (let i = 0; i < count; i++) {
      // Uniform direction on the unit sphere via inverse-CDF.
      const u = rng();
      const v = rng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const sinPhi = Math.sin(phi);
      // Shell radius — kept outside the orb's max displaced radius (~1.13) and
      // inside the camera frustum so particles stay visible without crowding.
      const r = 1.55 + rng() * 1.45;

      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = colorObjs[Math.floor(rng() * colorObjs.length)] ?? colorObjs[0]!;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, [seed.raw, palette, count]);

  useFrame((state) => {
    const p = pointsRef.current;
    if (!p) return;
    p.rotation.y = state.clock.elapsedTime * 0.04;
    p.rotation.x = Math.sin(state.clock.elapsedTime * 0.07) * 0.08;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/** The actual rotating mesh. Uses the dominant palette color as the base
 *  material color, with a complementary emissive tint from a secondary swatch. */
function Orb({
  palette,
  seed,
  config,
  orbY,
}: {
  palette: string[];
  seed: OrbSeed;
  config: OrbConfig | undefined;
  orbY: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const geometry = useDisplacedGeometry(seed, config);
  const baseColor = palette[0] ?? '#FF6B9D';
  const emissive = palette[1] ?? palette[0] ?? '#5E2A8C';

  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    // Gentle constant rotation on Y; tiny breathing tilt on X.
    m.rotation.y = seed.rotationStart + state.clock.elapsedTime * 0.2;
    m.rotation.x = Math.sin(state.clock.elapsedTime * 0.4 + seed.norm2) * 0.08;
  });

  return (
    // Lifted in world Y so the orb sits in the upper portion of the canvas,
    // leaving negative space below for the title + buttons. Camera lookAt is
    // still origin (R3F default), so this offsets the orb's projected position
    // upward within the frame while the particle field stays viewport-centered.
    <mesh ref={meshRef} geometry={geometry} position={[0, orbY, 0]}>
      <meshStandardMaterial
        color={baseColor}
        emissive={emissive}
        emissiveIntensity={0.18}
        metalness={0.55}
        roughness={0.35}
        flatShading
      />
    </mesh>
  );
}

/** Default scene parameters. Each is overridable via OrbConfig from the slide. */
const DEFAULT_ORB_Y = 0.4;
const DEFAULT_CAMERA_Z = 4.5;

export function OrbScene({ palette, seed, config, onCanvasCreated }: Props) {
  const orbY = config?.orbY ?? DEFAULT_ORB_Y;
  const cameraZ = config?.cameraZ ?? DEFAULT_CAMERA_Z;
  const particleCount = config?.particleCount ?? DEFAULT_PARTICLE_COUNT;

  return (
    <Canvas
      // Camera distance is configurable per-slide. Default z=4.5 keeps the orb
      // at ~54% of canvas height with comfortable atmosphere from particles.
      camera={{ position: [0, 0, cameraZ], fov: 45 }}
      gl={{
        // Required so saveOrbImage can call .toDataURL() on the canvas
        // without getting back a blank frame.
        preserveDrawingBuffer: true,
        antialias: true,
      }}
      dpr={[1, 2]}
      onCreated={(state) => {
        onCanvasCreated?.(state.gl.domElement);
      }}
    >
      {/* HDRI environment for subtle reflective depth on the orb's metalness.
       *  `background={false}` keeps the slide bg dark — env only contributes IBL.
       *  `studio` is small (~50KB) and gives clean neutral reflections that don't
       *  fight the palette colors.  */}
      <Environment preset="studio" background={false} environmentIntensity={0.35} />
      {/* 3-point lighting:
       *  Ambient — minimal lift, env handles most fill light now.
       *  Key — warm, front-upper-right, the dominant directional source.
       *  Fill — cool, lower-left, lifts the shadow side without flattening.
       *  Rim — bright, behind/above, carves the silhouette against the dark bg. */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[3, 4, 4]} intensity={1.3} color="#fff5e0" />
      <directionalLight position={[-3, -1.5, 2]} intensity={0.5} color="#9ec5ff" />
      <directionalLight position={[0, 2, -4]} intensity={1.4} color="#ffffff" />
      <Orb palette={palette} seed={seed} config={config} orbY={orbY} />
      {particleCount > 0 && (
        <ParticleField palette={palette} seed={seed} count={particleCount} />
      )}
    </Canvas>
  );
}
