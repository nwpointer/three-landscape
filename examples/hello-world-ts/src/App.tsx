import { Canvas, useThree } from "@react-three/fiber";
import { SplatMaterial } from "three-landscape";
import { OrbitControls, useTexture, Environment, FlyControls, FirstPersonControls, PointerLockControls, PerformanceMonitor, Stats } from "@react-three/drei";
import { Skybox } from './Skybox'
import { Vector4 } from 'three';
import { useEffect } from "react";

function Terrain() {

  const textures = useTexture([
    "/splat-rgb.jpg",
    "/Grass_021/ground_Grass1_col.jpg",
    "/Grass_021/ground_Grass1_norm.jpg",
    "/Mud_030/Ground_WetBumpyMud_col.jpg",
    "/Mud_030/Ground_WetBumpyMud_norm.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
    "/Rock_04/Rock_sobermanRockWall_col.jpg",
    "/Rock_04/Rock_sobermanRockWall_norm.jpg",
    "/heightmap@0.5.png",
    "/normalmap.png",
    "/splatmap_00.png",
    "/splatmap_01.png",
    "FORESTFLOOR-07/FORESTFLOOR-07_COLOR_2k.jpg",
    "FORESTFLOOR-07/FORESTFLOOR-07_NORMAL_2k.jpg"
  ]);

  const octaves = [
    {
      blur:0.5,
      amplitude: 1.25,
      wavelength: 1024.0*16.0,
      accuracy: 1.25
    },
    {
      blur:1.0,
      amplitude: 1.0,
      wavelength: 1024.0*64.0,
      accuracy: 1.0
    }
  ]

  // TODO: figure out why grass normal is whack

  const grass2 = {
    diffuse: textures[1],
    normal: textures[2],
    normalStrength: 0.0,
    repeat: 300,
    gridless: true,
    saturation: 0.60,
    tint: new Vector4(0.8,1.0,0.8,1),
    blend: {
      mode: "noise",
      octaves
    }
  };

  const grass1 = {
    diffuse: textures[1],
    normal: textures[2],
    normalStrength: 0.0,
    repeat: 300,
    saturation: 0.50,
    gridless: true,
    tint: new Vector4(0.8,1.0,0.8,1),
    blend: {
      mode: "noise",
      octaves
    }
  };

  const mud = {
    diffuse: textures[3],
    normal: textures[4],
    normalStrength: 0.45,
    repeat: 200,
    saturation: 0.5,
  };

  const clif = {
    diffuse: textures[7],
    normal: textures[8],
    normalStrength: 0.25,
    tint: new Vector4(1.5,1.5,1.5,1),
    trilinear: true,
    gridless: true,
    repeat: 400,
    saturation: 0.5,
  };

  // problem: this tock texture is suppose to add macro scratches etc but its getting blown out in the render
  // -> would be good to have a strength param or something to modify the weight
  const rock = {
    diffuse: textures[5],
    normal: textures[6],
    normalStrength: 0.5,
    tint: new Vector4(1.5,1.5,1.5,1),
    trilinear: true,
    gridless: true,
    repeat: 200,
    saturation: 0.5,
  };

  // TODO PRE RELEASE: Add AO map!!!!!!!!!!!!!!!!

  return textures ? (
    <mesh rotation={[-1*Math.PI/2,0,-3.35*Math.PI/2]} position={[0,0,0]}>
      <planeBufferGeometry args={[1024, 1024, 1024 * 1.0, 1024 * 1.0]} />
      <SplatMaterial
        splats={[textures[11], textures[12]]}
        // todo: after atlasing add mud back 
        surfaces={[rock, clif, mud, grass1, grass2, mud, mud]}
        normalMap={textures[10]}
        displacementMap={textures[9]}
        displacementScale={100.0 }
        normalScale={[1,1]}
        orientation={[-1,1]}
        envMapIntensity={0.35}
        metalness={0.5}
        // wireframe
        // roughness={0.85}
      />
    </mesh>
  ) : null;
}


function App() {

  return (
    <Canvas  camera={{fov:30, far: 2000, near:0.01, position:[0,3,3] }}>
      {/* <FirstPersonControls movementSpeed={100} lookSpeed={0.25} mom/> */}
      {/* <PointerLockControls /> */}
      <Stats />
      <OrbitControls />
      <Skybox fog={false} />
      <fog attach="fog" args={['#9fdced', 0, 2000]} />

      <Environment preset="park" background={false} />
      {/* <spotLight position={[100,1000,-100]} intensity={0.25} color="blue" />  */}
      {/* <spotLight position={[-100,1000,-100]} intensity={0.25} color="yellow" /> */}
      <ambientLight intensity={0.25} />
      <Terrain />
    </Canvas>
  );
}

export default App;
