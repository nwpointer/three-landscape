import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MartiniGeometry,
  TerrainMaterial,
  TerrainMesh,
  useVirtualTexture,
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
  Billboard,
  Cloud,
  Center,
  View,
  useFBO,
  RenderTexture,
  OrthographicCamera,
} from "@react-three/drei";
import { Skybox } from "./Skybox";
import {
  Color,
  MeshStandardMaterial,
  RGBFormat,
  Scene,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import {
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useControls } from "leva";
import { Perf } from "r3f-perf";
import { Preview } from "./Preview";

function getObjectsByProperty(object, property, value, result = []) {
  // check the current object

  if (object[property] === value) result.push(object);

  // check children

  for (let i = 0, l = object.children.length; i < l; i++) {
    const child = object.children[i];
    // console.log(child.userData);

    getObjectsByProperty(child, property, value, result);
  }

  return result;
}

function Terrain() {
  const {
    debugTextures,
    triplanar,
    gridless,
    noiseBlend,
    ao,
    meshError,
    wireframe,
    anisotropy,
  } = useControls({
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
      value: 10,
      min: 0,
      max: 300,
      description: "mesh error",
    },
    anisotropy: {
      value: 1,
      min: 1,
      max: 16,
      step: 1.0,
    },
    wireframe: false,
  });

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
      "/Cliffs_02/Rock_DarkCrackyCliffs_norm.png",
      "/Rock_04/Rock_sobermanRockWall_col.jpg",
      "/Rock_04/Rock_sobermanRockWall_norm.jpg",
      `/heightmap@0.5.png`,
      `/normalmap.png`,
      `/splatmap_00.png`,
      `/splatmap_01.png`,
      "/DebugTexture/debug.jpg",
      "/DebugTexture/debug_norm.png",
    ],
  ]);

  const t = textures[q];

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
    normalStrength: 0.2,
    repeat: 200,
    gridless: gridless,
    saturation: 0.7,
    tint: new Vector4(0.8, 1.0, 0.8, 1),
  };

  const grass1 = {
    diffuse: debugDiffuse ? t[13] : t[1],
    normal: debugNormal ? t[14] : t[2],
    normalStrength: 0.2,
    repeat: 200,
    saturation: 0.6,
    gridless: gridless,
    tint: new Vector4(0.8, 1.0, 0.8, 1),
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
    repeat: 200,
    saturation: 0.5,
  };

  const clif = {
    diffuse: debugDiffuse ? t[13] : t[7],
    normal: debugNormal ? t[14] : t[8],
    normalStrength: 0.4,
    tint: new Vector4(1.5, 1.5, 1.5, 1),
    triplanar: triplanar,
    gridless: gridless,
    repeat: 150,
    saturation: 0.5,
  };

  const rock = {
    diffuse: debugDiffuse ? t[13] : t[5],
    normal: debugNormal ? t[14] : t[6],
    normalStrength: 0.5,
    tint: new Vector4(1.5, 1.5, 1.5, 1),
    triplanar: triplanar,
    gridless: gridless,
    repeat: 150,
    saturation: 0.3,
  };

  return textures ? (
    <TerrainMesh
      userData={{ vt: 1 }}
      rotation={[(-1 * Math.PI) / 2, 0, (-3.35 * Math.PI) / 2]}
      position={[0, 0, 0]}
    >
      {/* Plan geometry works too: */}
      {/* <planeBufferGeometry args={[1024, 1024, 1024 * 1.0, 1024 * 1.0]} ref={geometry => {
        if(geometry){
          geometry.attributes.uv2 = geometry.attributes.uv.clone();
          geometry.needsUpdate = true;
        }
      }} /> */}
      <MartiniGeometry
        displacementMap={t[9]}
        error={meshError}
        userData={{ vMesh: true }}
      />

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
        splats={[t[11], t[12]]}
        surfaces={[rock, clif, mud, grass1, grass2, mud, mud]}
        normalMap={t[10]}
        displacementMap={t[9]}
        displacementScale={100.0}
        // normalScale={[1.5,1.5]}
        // orientation={[-1,1]}
        envMapIntensity={0.75}
        metalness={0.125}
        aoMap={t[0]}
        aoMapIntensity={ao}
        roughness={0.8}
        wireframe={wireframe}
        anisotropy={anisotropy}
      />
    </TerrainMesh>
  ) : null;
}

function CloudBank() {
  return (
    <>
      {" "}
      <group scale={[10, 10, 10]} position={[0, 300, 0]}>
        <Cloud position={[-4, -2, -25]} speed={0.2} opacity={1} />
        <Cloud position={[4, 2, -15]} speed={0.2} opacity={0.5} />
        <Cloud position={[-4, 2, -10]} speed={0.2} opacity={1} />
        <Cloud position={[4, -2, -5]} speed={0.2} opacity={0.5} />
        <Cloud position={[4, 2, 0]} speed={0.2} opacity={0.75} />
      </group>
      <group scale={[10, 10, 10]} position={[30, 290, 0]}>
        <Cloud position={[-4, -2, -25]} speed={0.2} opacity={1} />
        <Cloud position={[4, 2, -15]} speed={0.2} opacity={0.5} />
        <Cloud position={[-4, 2, -10]} speed={0.2} opacity={1} />
        <Cloud position={[4, -2, -5]} speed={0.2} opacity={0.5} />
        <Cloud position={[4, 2, 0]} speed={0.2} opacity={0.75} />
      </group>
      <group scale={[10, 10, 10]} position={[27.5, 310, 35]}>
        <Cloud position={[-4, -2, -25]} speed={0.2} opacity={1} />
        <Cloud position={[4, 2, -15]} speed={0.2} opacity={0.5} />
        <Cloud position={[-4, 2, -10]} speed={0.2} opacity={1} />
        <Cloud position={[4, -2, -5]} speed={0.2} opacity={0.5} />
        <Cloud position={[4, 2, 0]} speed={0.2} opacity={0.75} />
      </group>
    </>
  );
}

function DeterminatePreview() {
  const {determinant} = useVirtualTexture();
  return determinant && (
    <Preview renderPriority={1} scale={4} corner={[1, -1]} padding={[60, 60]}>
      <primitive object={determinant} attach="map" />
      {/* <TileSnoop attach="map" /> */}
    </Preview>
  );
}

function CachePreview() {
  const {cache} = useVirtualTexture();
  
  return cache && (
    <Preview
      renderPriority={2}
      width={200}
      height={200}
      corner={[-1, -1]}
      padding={[60, 60]}
    >
      <primitive object={cache} attach="map" />
    </Preview>
  );
}

function PageTablePreview() {
  const {pageTable} = useVirtualTexture();
  
  return pageTable && (
    <Preview
      renderPriority={2}
      width={150}
      height={150}
      corner={[-1, -1]}
      padding={[290, 60]}
    >
      <primitive object={pageTable} attach="map" />
    </Preview>
  );
}

function App() {
  return (
    <>
      <Canvas
        camera={{ fov: 30, far: 2000, near: 10.0, position: [0, 200, 200] }}
      >
        <Stats />
        {/* <Perf position="bottom-left" deepAnalyze={true} /> */}

        <OrbitControls />
        <ambientLight intensity={0.15} />
        <Suspense fallback={<Progress />}>
          <DeterminatePreview />
          <CachePreview />
          <PageTablePreview />
          <fog attach="fog" args={["#6dd1ed", 0, 2000]} />
          <Environment preset="park" background={false} />
          {/* <OrthographicCamera args={[-1,1,-1,1,1,1000]} zoom={1} makeDefault position={[0,0,1]} />
          <mesh>
            <planeBufferGeometry args={[1000,1000]} />
            <meshBasicMaterial color="red" />
          </mesh> */}
          <Skybox fog={false} />

          {/* <CloudBank /> */}
          <Terrain />
        </Suspense>
      </Canvas>
    </>
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
