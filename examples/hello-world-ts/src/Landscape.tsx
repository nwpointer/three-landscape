import { Canvas } from "@react-three/fiber";
import { LandscapeMaterial } from "three-landscape";
import { OrbitControls, useTexture } from "@react-three/drei";

function Terrain() {
  // const name = 'GRAVEL-11-RIVERBED';
  // const textures = useTexture([
  //   `/${name}/${name}_COLOR_2k.jpg`,
  //   `/${name}/${name}_NORMAL_2k.jpg`,
  //   `/${name}/${name}_ROUGHNESS_2k.jpg`,
  //   `/${name}/${name}_DEPTH_2k.png`
  // ]);

  const fname = 'GRAVEL-11-RIVERBED';
  const name = 'GRAVEL-11-RIVERBED';
  const textures = useTexture([
    `/${fname}/${name}_COLOR_2k.jpg`,
    `/${fname}/${name}_NORMAL_2k.jpg`,
    `/${fname}/${name}_ROUGHNESS_2k.jpg`,
    `/${fname}/${name}_DEPTH_2k.png`,
    "/heightmap@0.5.png",
  ]);

  

  const rock = {
    diffuse: textures[0],
    normal: textures[1],
    roughness: textures[2],
    height: textures[3],
    repeat: 100,
    paralax: {
      mode: 'relief',
      minLayers: 0,
      maxLayers: 32,
      scale: 1.0
    } 
    // triplanar: true,
  };

  // example rgb
  return textures ? (
    <mesh rotation={[-Math.PI/2,0,0]}>
      <planeBufferGeometry args={[6, 6, 1024.0, 1024.0]} />
      {/* <meshStandardMaterial
        map={rock.diffuse}
        normalMap={rock.normal}
        displacementMap={rock.height}
        displacementScale={0.5}
      />
       */}
      <LandscapeMaterial
        materials={[rock]}
        map={rock.diffuse}
        normalMap={rock.normal}
        normalScale={2.0}
        displacementMap={textures[4]}
        displacementScale={1.0}
        // wireframe
      />
    </mesh>
  ) : null;
}

function App() {
  return (
    <Canvas camera={{ near: 0.0001, position:[0,3,3] }}>
      <OrbitControls />
      <ambientLight intensity={0.25} />
      <directionalLight intensity={0.75} />
      <Terrain />
    </Canvas>
  );
}

export default App;
