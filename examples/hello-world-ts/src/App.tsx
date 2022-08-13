import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { TerrainMaterial } from "three-landscape";
import { OrbitControls, useTexture } from "@react-three/drei";

function Terrain() {
  const textures = useTexture([
    "/splat.jpg",
    "/Grass_021/ground_Grass1_col.jpg",
    "/Grass_021/ground_Grass1_norm.jpg",
    "/Mud_030/Ground_WetBumpyMud_col.jpg",
    "/Mud_030/Ground_WetBumpyMud_norm.jpg",
  ]);

  return (
    <mesh position={[0, 0, 0]}>
      <planeBufferGeometry args={[4, 4, 10, 10]} />
      <TerrainMaterial
        map={textures[0]}
        splats={[textures[0]]}
        materials={[
          // grass
          {
            diffuse: textures[1],
            normal: textures[2],
          },
          // mud
          {
            diffuse: textures[3],
            normal: textures[4],
          },
        ]}
      />
    </mesh>
  );
}

function App() {
  return (
    <Canvas>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <Terrain />
    </Canvas>
  );
}

export default App;
