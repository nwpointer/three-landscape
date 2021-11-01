import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Detailed } from "@react-three/drei";

export function Scene() {
  return (
    <Canvas>
      <OrbitControls />
      <ambientLight intensity={1} />
      <mesh>
        <Detailed distances={[10, 20, 30]}>
          <mesh>
            <sphereBufferGeometry args={[10, 100, 100]} />
            <meshStandardMaterial color="red" wireframe />
          </mesh>
          <mesh>
            <sphereBufferGeometry args={[10, 25, 25]} />
            <meshStandardMaterial color="red" wireframe />
          </mesh>
          <mesh>
            <sphereBufferGeometry args={[10, 10, 10]} />
            <meshStandardMaterial color="red" wireframe />
          </mesh>
        </Detailed>
      </mesh>
    </Canvas>
  );
}
