import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MartiniGeometry,
  TerrainMaterial,
  useProgressiveTextures,
} from "three-landscape";
import {
  OrbitControls,
  useTexture,
  Environment,
  FlyControls,
  FirstPersonControls,
  PointerLockControls,
  PerformanceMonitor,
  Stats,
  useProgress,
  Html,
} from "@react-three/drei";
import { Skybox } from "./Skybox";
import { MeshStandardMaterial, Vector4, Vector3 } from "three";
import { Suspense, useEffect, useState } from "react";
import { useControls } from "leva";
import { Perf } from "r3f-perf";

function Terrain() {
  const {camera} = useThree();
  const [cameraPosition, setCameraPosition] = useState(new Vector3(0,0,0));
  const { debugTextures, triplanar, gridless, useMacro, noiseBlend, ao, meshError, smoothness, wireframe, surfaceLimit, anisotropy } =
    useControls({
      debugTextures: false,
      triplanar: false,
      gridless: false,
      noiseBlend: false,
      ao: {
        value: 0.62,
        min: 0,
        max: 2.0,
      },
      meshError: {
        value: 0,
        min: 0,
        max: 300,
        description: "mesh error"
      },
      smoothness: {
        value: 0,
        min: 0,
        max: 20,
        step: 0.1,
      },
      anisotropy: {
        value: 1,
        min: 1,
        max: 16,
        step: 1.0,
      },
      surfaceLimit: {
        value: 3,
        min: 1,
        max: 8,
        step: 1.0,
      },
      useMacro: false,

      wireframe: false
    });

    // req calc to be off the main thread
    // useFrame(() => {
    //   var v = camera.position.distanceTo(cameraPosition);
    //   if(v > 400.0){
    //     setCameraPosition(camera.position.clone());
    //     console.log('frame geometry')
    //   }
    // });

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

  const [q, textures] = useProgressiveTextures([
    [
      "/aomap.png",
      "/Grass_02/ground_Grass1_col.jpg",
      "/Grass_02/ground_Grass1_norm.jpg",
      "/Mud_03/Ground_WetBumpyMud_col.jpg",
      "/Mud_03/Ground_WetBumpyMud_norm.jpg",
      "/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg",
      "/Cliffs_02/Rock_DarkCrackyCliffs_norm.jpg",
      "/Rock_04/Rock_sobermanRockWall_col.jpg",
      "/Rock_04/Rock_sobermanRockWall_norm.jpg",
      `/heightmap@0.5.png`,
      `/normalmap.png`,
      `/splatmap_00.png`,
      `/splatmap_01.png`,
      "/DebugTexture/debug.jpg",
      "/DebugTexture/debug_norm.png",
      "/T_MacroVariation_sm.png"
    ],
  ]);

  // @ts-ignore
  const t = textures[q]

  const octaves = [
    {
      blur: 0.5,
      amplitude: 1.25,
      wavelength: 1024.0 * 16.0,
      accuracy: 1.25,
    },
    {
      blur: 1.0,
      amplitude: 1.0,
      wavelength: 1024.0 * 64.0,
      accuracy: 1.0,
    },
  ];

  // TODO: figure out why grass normal is whack

  const debugDiffuse = debugTextures;
  const debugNormal = debugTextures;

  const grass2 = {
    diffuse: debugDiffuse ? t[13] : t[1],
    normal: debugNormal ? t[14] : t[2],
    normalStrength: 0.3,
    repeat: 300,
    gridless: gridless,
    saturation: 0.55,
    tint: new Vector4(0.9, 1.0, 0.9, 1),
  };

  const grass1 = {
    diffuse: debugDiffuse ? t[13] : t[1],
    normal: debugNormal ? t[14] : t[2],
    normalStrength: 0.3,
    repeat: 300,
    // saturation: 0.5,
    gridless: gridless,
    tint: new Vector4(0.9, 1.0, 0.9, 1),
  };

  if (noiseBlend) {
    //@ts-ignore
    grass1.blend = {
      mode: "noise",
      octaves,
    };
    //@ts-ignore
    grass2.blend = {
      mode: "noise",
      octaves,
    };
  }

  const mud = {
    diffuse: debugDiffuse ? t[13] : t[3],
    normal: debugNormal ? t[14] : t[4],
    normalStrength: 0.5,
    repeat: 300,
    saturation: 0.5,
  };

  const clif = {
    diffuse: debugDiffuse ? t[13] : t[7],
    normal: debugNormal ? t[14] : t[8],
    normalStrength: 0.5,
    normalY: -1,
    tint: new Vector4(1.2, 1.2, 1.2, 1),
    triplanar: triplanar,
    gridless: gridless,
    repeat: 300,
    saturation: 0.5,
  };

  const rock = {
    diffuse: debugDiffuse ? t[13] : t[5],
    normal: debugNormal ? t[14] : t[6],
    normalStrength: 0.4,
    tint: new Vector4(1.2, 1.2, 1.2, 1),
    triplanar: triplanar,
    gridless: gridless,
    repeat: 300,
    saturation: 0.3,
  };

  let cameraError = camera.position.distanceTo(new Vector3(0,0,0));

  return textures ? (
    <mesh
      rotation={[(-1 * Math.PI) / 2, 0, (-3.35 * Math.PI) / 2]}
      position={[0, 0, 0]}
    >
      {/* Plan geometry works too: */}
      {/* <planeBufferGeometry args={[1024, 1024, 2**11, 2**11]} ref={geometry => {
        if(geometry){
          geometry.attributes.uv2 = geometry.attributes.uv.clone();
          geometry.needsUpdate = true;
        }
      }} /> */}
      {/* determine based on platform */}
      <MartiniGeometry displacementMap={t[9]} error={meshError+120} mobileError={meshError+200} />

      {/* Comparable standard material */}
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
        //@ts-ignore
        splats={[t[11], t[12]]}
        surfaces={[rock, clif, mud, grass1, grass2, mud, mud]}
        normalMap={t[10]}
        displacementMap={t[9]}
        displacementScale={120.0}
        // displacementScale={0.0}
        displacementBias={0.0}
        // normalScale={[1.5,1.5]}
        // orientation={[-1,1]}
        envMapIntensity={0.75}
        metalness={0.125}
        aoMap={t[0]}
        aoMapIntensity={ao}
        roughness={0.8}
        wireframe={wireframe}
        anisotropy={anisotropy}
        surfaceLimit={surfaceLimit}
        smoothness = {smoothness}
        macroMap = {t[15]}
        useMacro = {useMacro}
      />
    </mesh>
  ) : null;
}

function App() {
  const { atmosphere } = useControls({
    atmosphere: {
      value: false
    }
  });
  return (
    <Canvas
      camera={{ fov: 60, far: 50000000000, near: 1.0, position: [0, 200, 200] }}
    >
      <Stats />
      {/* <Perf position="bottom-left" deepAnalyze={true} /> */}
      <OrbitControls />
      {/* <fog attach="fog" args={['#9fdced', 0, 2000]} /> */}
      {/* <fog attach="fog" args={["#6dd1ed", atmosphere ? 0 : 2500, 2500]} /> */}
      {/* <ambientLight intensity={0.15} color="yellow" /> */}
      <ambientLight intensity={0.15} />
      <Suspense fallback={<Progress />}>
        <Environment preset="park" background={false} />
        <Skybox fog={false} />
        <Terrain />
      </Suspense>
    </Canvas>
  );
}

const Progress = () => {
  const state = useProgress();

  return (
    <Html center>
      <div
        style={{ border: "1px solid white", height: "10px", width: "100px" }}
      >
        <div
          style={{
            background: "white",
            height: "10px",
            width: `${state.progress}px`,
          }}
        />
      </div>
    </Html>
  );
};

export default App;
