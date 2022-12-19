import { Canvas, useThree } from "@react-three/fiber";
import { TerrainMaterial, useProgressiveTextures, MartiniGeometry } from "three-landscape";
import { OrbitControls, useTexture, Environment, FlyControls, FirstPersonControls, PointerLockControls, PerformanceMonitor, Stats, useProgress, Html } from "@react-three/drei";
import { Skybox } from './Skybox'
import { MeshStandardMaterial, Vector3, Vector4, DoubleSide } from 'three';
import { Suspense, useEffect, useMemo } from "react";
import { useControls } from 'leva'
// import { Perf } from 'r3f-perf';

function Terrain() {

  const { debugTextures, trilinear, gridless, noiseBlend, ao, limit, tint, saturation, error } = useControls({debugTextures:false, trilinear: false, gridless: false, noiseBlend:false, ao: {
    value: 0.75,
    min:0,
    max: 2.0
  },
  limit: {
    min: 0,
    max: 2000,
    // initial value of 4, 5
    value: [0, 500],
  },
  tint: {
    x: 1.0,
    y: 1.0,
    z: 1.0,
  },
  saturation: { value: 0.62, min: 0, max:2},
  error: {
    min:0,
    max: 1000,
    value: 0,
  }
 })

  /*
  [
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
  ]
  */

  const [q, textures] = useProgressiveTextures([[
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
    `/normalmap.png`,
    `/splatmap_00.png`,
    `/splatmap_01.png`,
    "/DebugTexture/debug.jpg",
    "/DebugTexture/debug_norm.png",
    "/colormap.png"
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

  const debugDiffuse = debugTextures;
  const debugNormal = debugTextures;

  const grass2 = {
    diffuse: debugDiffuse ? t[13] : t[1],
    normal: debugNormal ? t[14] : t[2],
    normalStrength: 0.1,
    repeat: 200,
    gridless: gridless,
    saturation,
    tint: new Vector4(0.6,0.6,0.6,1),
  };

  const grass1 = {
    diffuse: debugDiffuse ? t[13] : t[1],
    normal: debugNormal ? t[14] : t[2],
    normalStrength: 0.1,
    repeat: 200,
    saturation,
    gridless: gridless,
    tint: new Vector4(0.8,1.0,0.8,1),
  };

  if(noiseBlend){
    //@ts-ignore
    grass1.blend = {
      mode: "noise",
      octaves
    }
    //@ts-ignore
    grass2.blend = {
      mode: "noise",
      octaves
    }
  }

  const mud = {
    diffuse: debugDiffuse ? t[13] : t[3],
    normal: debugNormal ? t[14] : t[4],
    normalStrength: 0.5,
    repeat: 200,
    saturation: 0.5,
  };

  const clif = {
    diffuse: debugDiffuse ? t[13] : t[7],
    normal: debugNormal ? t[14] : t[8],
    normalStrength: 0.40,
    tint: new Vector4(1.5,1.5,1.5,1),
    trilinear: trilinear,
    gridless: gridless,
    repeat: 150,
    saturation: 0.5,
  };

  const rock = {
    diffuse: debugDiffuse ? t[13] : t[5],
    normal: debugNormal ? t[14] : t[6],
    normalStrength: 0.5,
    tint: new Vector4(1.5,1.5,1.5,1),
    trilinear: trilinear,
    gridless: gridless,
    repeat: 150,
    saturation: 0.3
  };

  return textures ? (
    <mesh rotation={[-1*Math.PI/2,0,-3.35*Math.PI/2]} position={[0,0,0]}>
      {/* <planeBufferGeometry args={[1024, 1024, 1024 * 1.0, 1024 * 1.0]} ref={geometry => {
        if(geometry){
          geometry.attributes.uv2 = geometry.attributes.uv.clone();
          console.log(geometry.attributes.uv2 );
          
          geometry.needsUpdate = true;
        }
      }} /> */}
      <MartiniGeometry displacementMap={t[9]} args={[1024, 1024, 1024 * 1.0, 1024 * 1.0]} error={error} />
      {/* <meshStandardMaterial
        normalMap={t[10]}
        displacementMap={t[9]}
        displacementScale={100.0 }
        envMapIntensity={0.35}
        metalness={0.125}
        aoMap = {t[0]}
        aoMapIntensity={ao}
        roughness={0.8}
      /> */}
      <TerrainMaterial
        splats={[t[11], t[12]]}
        surfaces={[rock, clif, mud, grass1, grass2, mud, mud]}
        normalMap={t[10]}
        displacementMap={t[9]}
        displacementScale={100.0 }
        // normalScale={[1.5,1.5]}
        // orientation={[-1,1]}
        envMapIntensity={0.75}
        metalness={0.125}
        aoMap = {t[0]}
        aoMapIntensity={ao}
        roughness={0.8}
        map={t[15]} // fallback
        limit={limit}
        tint={new Vector4(...Object.values(tint), 1.0)}
        saturation={saturation}
        // side={DoubleSide}
      />
    </mesh>
  ) : null;
}

function MartiniTerrain(){
  const {error} = useControls({error: {
    min:0,
    max: 1000,
    value: 0,
  }})
  const [q, textures] = useProgressiveTextures([[
    "/heightmap@0.5.png",
    "/aomap.png",
  ]]);
  return (
    <mesh rotation={[-1*Math.PI/2,0,-3.35*Math.PI/2]} scale={new Vector3(1,1,1)}>
      {/* <planeBufferGeometry></planeBufferGeometry> */}
      <MartiniGeometry displacementMap={textures[q][0]} args={[1024, 1024, 1024 * 1.0, 1024 * 1.0]} error={error} />
      <meshStandardMaterial side={DoubleSide} map={textures[q][0]} wireframe displacementMap={textures[q][0]} displacementScale={-200} />
    </mesh>
  )
}




function App() {
  return (
    <Canvas camera={{fov:30, far: 2000, near:10, position:[0,200,200] }}>
      <Stats />
      {/* <Perf position="bottom-left" deepAnalyze={true} /> */}
      <OrbitControls />
      {/* <fog attach="fog" args={['#9fdced', 0, 2000]} /> */}
      <fog attach="fog" args={['#6dd1ed', 0, 2000]} />
      {/* <ambientLight intensity={0.15} color="yellow" /> */}
      <ambientLight intensity={0.15} />
      {/* <ambientLight intensity={1} /> */}
      <Suspense fallback={<Progress />}>
        <Environment preset="park" background={false} />
        <Skybox fog={false} />
        <Terrain />
        {/* <MartiniTerrain /> */}
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
