import React, { useEffect, useState, useRef } from "react";
import { Canvas, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { BasisTextureLoader } from "three/examples/jsm/loaders/BasisTextureLoader.js";

function Image() {
  const { gl } = useThree();
  const ref = useRef();
  const texture = useLoader(
    BasisTextureLoader,
    "/hd/normalmap.basis",
    (loader) => {
      loader.setTranscoderPath("/");
      loader.detectSupport(gl);
    }
  );

  // flipY
  useEffect(() => {
    if (ref.current) {
      const uv = ref.current.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setY(i, 1 - uv.getY(i));
      }
    }
  }, ref);

  return (
    <mesh>
      <planeBufferGeometry ref={ref} args={[7, 7]} />
      <meshStandardMaterial map={texture} flipY={false} />
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
