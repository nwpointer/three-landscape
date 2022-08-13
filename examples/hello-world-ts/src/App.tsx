import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Cube } from "three-landscape";

function App() {
  return (
    <Canvas>
      <ambientLight />
      <Cube position={[1, 0, 0]} />
      <Cube position={[0, 0, 0]} />
    </Canvas>
  );
}

export default App;
