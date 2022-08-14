import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { TerrainMaterial } from "three-landscape";
import { OrbitControls, useTexture } from "@react-three/drei";
import { RepeatWrapping, Texture } from "three";

const repeatTexture = (t: Texture) => (t.wrapS = t.wrapT = RepeatWrapping);

// function Terrain() {
//   const textures = useTexture([
//     "/splat-bw.jpg",
//     "/Grass_021/ground_Grass1_col.jpg",
//     "/Grass_021/ground_Grass1_norm.jpg",
//     "/Mud_030/Ground_WetBumpyMud_col.jpg",
//     "/Mud_030/Ground_WetBumpyMud_norm.jpg",
//   ]);

//   textures.map(repeatTexture);

//   const grass = {
//     diffuse: textures[1],
//     normal: textures[2],
//     repeat: 10,
//   };

//   const mud = {
//     diffuse: textures[3],
//     normal: textures[4],
//     repeat: 2,
//   };

//   // example bw
//   return (
//     <mesh position={[0, 0, 0]}>
//       <planeBufferGeometry args={[4, 4, 10, 10]} />
//       <TerrainMaterial map={textures[0]} splats={[textures[0]]} materials={[grass, mud]} />
//     </mesh>
//   );
// }

function Terrain() {
  const textures = useTexture([
    "/splat-rgb.jpg",
    "/Grass_021/ground_Grass1_col.jpg",
    "/Grass_021/ground_Grass1_norm.jpg",
    "/Mud_030/Ground_WetBumpyMud_col.jpg",
    "/Mud_030/Ground_WetBumpyMud_norm.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_col.png",
    "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
  ]);

  textures.map(repeatTexture);

  const grass = {
    diffuse: textures[1],
    normal: textures[2],
    repeat: 10,
  };

  const mud = {
    diffuse: textures[3],
    normal: textures[4],
    repeat: 2,
  };

  const clif = {
    diffuse: textures[5],
    normal: textures[6],
    repeat: 2,
  };
  console.log(textures[0].isTexture);

  // example bw
  return textures ? (
    <mesh position={[0, 0, 0]}>
      <planeBufferGeometry args={[4, 4, 10, 10]} />
      <TerrainMaterial splatMode="rgb" map={textures[0]} splats={[textures[0]]} materials={[grass, mud, clif]} />
    </mesh>
  ) : null;
}

function App() {
  return (
    <Canvas camera={{ near: 0.001 }}>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <Terrain />
    </Canvas>
  );
}

export default App;
