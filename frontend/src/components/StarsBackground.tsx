"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";

export function StarsBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 1] }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Stars
          radius={80}
          depth={60}
          count={2500}
          factor={3}
          saturation={0}
          fade
          speed={0.5}
        />
      </Canvas>
    </div>
  );
}
