import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { TerrainMaterial } from "three-landscape";
import { OrbitControls, useTexture } from "@react-three/drei";
import { RepeatWrapping, Texture, LinearMipmapNearestFilter } from "three";

// function Terrain() {
//   const textures = useTexture([
//     "/splat-bw.jpg",
//     "/Grass_021/ground_Grass1_col.jpg",
//     "/Grass_021/ground_Grass1_norm.jpg",
//     "/Mud_030/Ground_WetBumpyMud_col.jpg",
//     "/Mud_030/Ground_WetBumpyMud_norm.jpg",
//   ]);

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

function Test() {
  const textures = useTexture([
    "/Grass_021/ground_Grass1_col.jpg",
    "/Grass_021/ground_Grass1_norm.jpg",
    "/Mud_030/Ground_WetBumpyMud_col.jpg",
    "/Mud_030/Ground_WetBumpyMud_norm.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_col.png",
    "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
  ]);
  textures.map((t) => {
    t.minFilter = LinearMipmapNearestFilter;
  });
  return (
    <mesh>
      <planeBufferGeometry args={[5, 5]}></planeBufferGeometry>
      <meshStandardMaterial
        map={textures[0]}
        normalMap={textures[1]}
        vertextTangents={true}
        metalness={0.25}
        roughness={0.25}
      ></meshStandardMaterial>
    </mesh>
  );
}

function Terrain() {
  const textures = useTexture([
    "/splat-rgb.jpg",
    "/Grass_021/ground_Grass1_col.jpg",
    "/Grass_021/ground_Grass1_norm.jpg",
    "/Mud_030/Ground_WetBumpyMud_col.jpg",
    "/Mud_030/Ground_WetBumpyMud_norm.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_col.png",
    "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
    "simplex-noise.png",
  ]);

  const grass = {
    diffuse: textures[1],
    normal: textures[2],
    repeat: 10,
  };

  const mud = {
    diffuse: textures[3],
    normal: textures[4],
    normalScale: 0.5,
    repeat: 10,
  };

  const clif = {
    diffuse: textures[5],
    normal: textures[6],
    normalScale: 2.0,
    repeat: 10,
    sampler: "tiled",
  };

  // example rgb
  return textures ? (
    <mesh position={[0, 0, 0]}>
      <planeBufferGeometry args={[6, 6, 10, 10]} />
      <TerrainMaterial
        splatMode="rgb"
        map={textures[0]}
        splats={[textures[0]]}
        materials={[grass, mud, clif]}
      />
    </mesh>
  ) : null;
}

function App() {
  return (
    <Canvas>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.5} />
      {/* <spotLight args={["white", 0.5, 5]} /> */}
      <Terrain />
      {/* <Test /> */}
    </Canvas>
  );
}

export default App;
