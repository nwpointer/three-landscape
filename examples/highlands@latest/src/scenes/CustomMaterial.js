import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import "../ColorShiftMaterial";

export function Scene() {
  const [state, setState] = useState(0);
  useEffect(() => {
    const intervalID = setInterval(() => setState((state) => state + 0.01), 10);
    return () => clearInterval(intervalID);
  }, []);
  return (
    <Canvas style={{ background: "red" }}>
      <OrbitControls />
      <ambientLight intensity={1} />
      <mesh position={[1, 0, 0]}>
        <boxBufferGeometry />
        <colorShiftMaterial attach="material" color="hotpink" time={state} />
      </mesh>
    </Canvas>
  );
}
