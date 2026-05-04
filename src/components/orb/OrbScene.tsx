import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { OrbSeed } from './useOrbSeed';

interface Props {
  palette: string[];
  seed: OrbSeed;
  /** Set true when capturing a frame for download. R3F renders on-demand by
   *  default, but `preserveDrawingBuffer` is needed for `toDataURL` to work. */
  onCanvasCreated?: (canvas: HTMLCanvasElement) => void;
}

/** The actual rotating icosahedron mesh. Uses the dominant palette color
 *  as the base material color, with a complementary emissive tint pulled
 *  from a secondary palette swatch (or the same color, slightly lifted). */
function Orb({ palette, seed }: { palette: string[]; seed: OrbSeed }) {
  const meshRef = useRef<Mesh>(null);
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
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={baseColor}
        emissive={emissive}
        emissiveIntensity={0.18}
        metalness={0.35}
        roughness={0.42}
        flatShading
      />
    </mesh>
  );
}

export function OrbScene({ palette, seed, onCanvasCreated }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 45 }}
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
      {/* Soft ambient + a single warm key light, per Phase 1 spec */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 4]} intensity={1.1} color="#fff5e0" />
      {/* A subtle fill from the opposite side keeps the dark hemisphere readable */}
      <directionalLight position={[-3, -2, 2]} intensity={0.35} color="#9ec5ff" />
      <Orb palette={palette} seed={seed} />
    </Canvas>
  );
}
