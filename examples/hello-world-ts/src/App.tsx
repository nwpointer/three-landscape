import { Canvas, useThree } from "@react-three/fiber";
import { TerrainMaterial, useProgressiveTexture } from "three-landscape";
import { OrbitControls, useTexture, Environment, FlyControls, FirstPersonControls, PointerLockControls, PerformanceMonitor, Stats, useProgress, Html } from "@react-three/drei";
import { Skybox } from './Skybox'
import { Vector4 } from 'three';
import { Suspense, useEffect } from "react";

function Terrain() {

  const [q, textures] = useProgressiveTexture([[
    "/aomap.png",
    "/Grass_02/ground_Grass1_col.jpg",
    "/Grass_02/ground_Grass1_norm.jpg",
    "/Mud_03/Ground_WetBumpyMud_col.jpg",
    "/Mud_03/Ground_WetBumpyMud_norm.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
    "/Rock_04/Rock_sobermanRockWall_col.jpg",
    "/Rock_04/Rock_sobermanRockWall_norm.jpg",
    `/heightmap@0.5.png`,
    `/normalmap@0.5.png`,
    `/splatmap_00@0.5.png`,
    `/splatmap_01@0.5.png`
  ],[
    "/aomap.png",
    "/Grass_02/ground_Grass1_col.jpg",
    "/Grass_02/ground_Grass1_norm.jpg",
    "/Mud_03/Ground_WetBumpyMud_col.jpg",
    "/Mud_03/Ground_WetBumpyMud_norm.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg",
    "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
    "/Rock_04/Rock_sobermanRockWall_col.jpg",
    "/Rock_04/Rock_sobermanRockWall_norm.jpg",
    `/heightmap.png`,
    `/normalmap.png`,
    `/splatmap_00.png`,
    `/splatmap_01.png`
  ]]);

  const t = textures[q];

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
    diffuse: t[1],
    normal: t[2],
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
    diffuse: t[1],
    normal: t[2],
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
    diffuse: t[3],
    normal: t[4],
    normalStrength: 0.45,
    repeat: 200,
    saturation: 0.5,
  };

  const clif = {
    diffuse: t[7],
    normal: t[8],
    normalStrength: 0.25,
    tint: new Vector4(1.5,1.5,1.5,1),
    trilinear: true,
    gridless: true,
    repeat: 400,
    saturation: 0.5,
  };

  const rock = {
    diffuse: t[5],
    normal: t[6],
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
      <TerrainMaterial
        splats={[t[11], t[12]]}
        surfaces={[rock, clif, mud, grass1, grass2, mud, mud]}
        normalMap={t[10]}
        displacementMap={t[9]}
        displacementScale={100.0 }
        normalScale={[1,1]}
        orientation={[-1,1]}
        envMapIntensity={0.35}
        metalness={0.5}
        // aoMap = {t[0]}
        // roughness={0.8}
      />
    </mesh>
  ) : null;
}


function App() {
  return (
    <Canvas camera={{fov:30, far: 2000, near:0.01, position:[0,200,200] }}>
      {/* <Stats /> */}
      <OrbitControls />
      <fog attach="fog" args={['#9fdced', 0, 2000]} />
      <ambientLight intensity={0.25} />
      <Suspense fallback={<Progress />}>
        <Environment preset="park" background={false} />
        <Skybox fog={false} />
        <Terrain />
      </Suspense>
    </Canvas>
  );
}


const Progress = () => {
  const state = useProgress()

  return (
    <Html center>
      <div style={{ border: '1px solid white', height: '10px', width: '100px' }}>
        <div style={{ background: 'white', height: '10px', width: `${state.progress}px` }} />
      </div>
    </Html>
  )
}

export default App;
