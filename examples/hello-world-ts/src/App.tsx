import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Cube } from "three-landscape";

function App() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <Cube position={[1, 0, 0]} />
      <Cube position={[0, 1, 0]} />
    </Canvas>
  );
}

export default App;
