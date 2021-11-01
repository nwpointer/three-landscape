import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { useProgressiveTexture } from "../components/useProgressiveTexture";

function Image() {
  const texture = useProgressiveTexture(["/80px-Bounan_moutain.jpg", "/Bounan_moutain.jpg"]);
  return (
    <mesh>
      <planeBufferGeometry args={[10, 7]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

export function Scene({ time }) {
  return (
    <Canvas style={{ background: "black" }}>
      <OrbitControls />
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <Image />
      </Suspense>
    </Canvas>
  );
}
