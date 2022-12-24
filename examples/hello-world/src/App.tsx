import { Canvas } from "@react-three/fiber";
import { TerrainMaterial } from "three-landscape";
import {
  OrbitControls,
  Environment,
  useTexture,
} from "@react-three/drei";
import { Suspense } from "react"
import { LoadingBar } from "./LoadingBar";
import { Skybox } from "./Skybox";

function Terrain() {
  const [
    displacementMap,
    splatMap,
    normalMap,
    grassDiffuse,
    grassNormal,
    rockDiffuse,
    rockNormal,
    mudDiffuse,
    mudNormal
  ] = useTexture([
    `/HeightMap.jpg`,
    `/SplatMap.jpg`,
    `/NormalMap.png`,
    "/Grass_02/ground_Grass1_col.jpg",
    "/Grass_02/ground_Grass1_norm.jpg",
    "/Rock_04/Rock_sobermanRockWall_col.jpg",
    "/Rock_04/Rock_sobermanRockWall_norm.jpg",
    "/Mud_03/Ground_WetBumpyMud_col.jpg",
    "/Mud_03/Ground_WetBumpyMud_norm.jpg",
  ])

  const grass = {
    diffuse: grassDiffuse,
    normal: grassNormal,
    normalStrength: 0.2,
    gridless: true,
    repeat: 200,
  };

  const rock = {
    diffuse: rockDiffuse,
    normal: rockNormal,
    normalStrength: 0.5,
    gridless: true,
    repeat: 150
  };

  const mud = {
    diffuse: mudDiffuse,
    normal: mudNormal,
    normalStrength: 0.5,
    gridless: true,
    repeat: 150
  };

  return (
    <mesh
      rotation={[(-Math.PI) / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <planeBufferGeometry args={[1024, 1024, 256/2, 256/2]}/>
      <TerrainMaterial
        splats={[splatMap]}
        surfaces={[rock, grass, mud]}
        normalMap={normalMap}
        displacementMap={displacementMap}
        displacementScale={100.0}
        envMapIntensity={0.25}
        metalness={0.125}
      />
    </mesh>
  );
}

function App() {
  return (
    <Canvas
      camera={{ fov: 30, far: 2000, near: 10.0, position: [0, 200, 200] }}
    >
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <Suspense fallback={<LoadingBar />}>
        <Environment preset="park" background={false} />
        <Skybox />
        <Terrain />
      </Suspense>
    </Canvas>
  );
}

export default App;
