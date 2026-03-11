"use client";

import { useEffect, useRef, useCallback } from "react";
import createGlobe from "cobe";

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  }, []);

  const onPointerUp = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const onPointerOut = useCallback(() => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerInteracting.current !== null) {
      const delta = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const size = container.offsetWidth;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas dimensions to match container
    canvasRef.current.width = size * dpr;
    canvasRef.current.height = size * dpr;

    globeRef.current = createGlobe(canvasRef.current, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 20000,
      mapBrightness: 2.5,
      baseColor: [0.08, 0.15, 0.12],
      markerColor: [0.2, 0.83, 0.6],
      glowColor: [0.04, 0.1, 0.08],
      markers: [
        { location: [37.7749, -122.4194], size: 0.06 },
        { location: [40.7128, -74.006], size: 0.05 },
        { location: [51.5074, -0.1278], size: 0.04 },
        { location: [1.3521, 103.8198], size: 0.05 },
        { location: [22.3193, 114.1694], size: 0.04 },
        { location: [35.6762, 139.6503], size: 0.03 },
        { location: [48.8566, 2.3522], size: 0.03 },
        { location: [-33.8688, 151.2093], size: 0.03 },
        { location: [25.2048, 55.2708], size: 0.04 },
        { location: [47.3769, 8.5417], size: 0.04 },
      ],
      onRender: (state) => {
        if (pointerInteracting.current === null) {
          phiRef.current += 0.003;
        }
        state.phi = phiRef.current + pointerInteractionMovement.current / 200;
        state.width = size * dpr;
        state.height = size * dpr;
      },
    });

    return () => {
      globeRef.current?.destroy();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full aspect-square">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOut={onPointerOut}
        onPointerMove={onPointerMove}
        style={{
          cursor: "grab",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
