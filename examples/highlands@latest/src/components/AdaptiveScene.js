import { Canvas, extend } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import DynamicBufferGeometry, { update } from './three-landscape/three/DynamicPlaneGeometry';
import { DoubleSide, Float32BufferAttribute } from 'three';

import { SplatStandardMaterial } from './three-landscape/SplatMaterial'
import { useProgressiveTextures } from './three-landscape/useProgressiveTexture'

extend({ DynamicBufferGeometry });

export function Scene() {

  return (
    <Canvas linear style={{ background: 'black' }} camera={{ near: 0.000001 }}>
      <OrbitControls />
      <ambientLight intensity={1} />
      <Stats />
      <Suspense fallback={<Progress />}>
        <fog attach="fog" args={['#74bbd0', 0, 200]} />
        <Terrain />
      </Suspense>
    </Canvas>
  )
}

const SimpleTerrain = () => {
  const texture = useTexture('/hd/normalmap.png')
  const height = useTexture('/hd/heightmap.png')

  return (
    <mesh position={[-1, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <dynamicBufferGeometry args={[2, 2]} />
      {/* <planeBufferGeometry args={[1, 1, 2500, 2500]} /> */}
      <meshStandardMaterial side={DoubleSide} map={texture} wireframe side={DoubleSide} displacementMap={height} displacementScale={0.5} />
    </mesh>
  )
}

const Terrain = () => {
  const [highestQualityLoaded, textures] = useProgressiveTextures([
    [
      '/hd/heightmap.png',
      '/hd/normalmap_y@0.5.basis',
      '/simplex-noise.png',
      '/Assets/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg',
      '/Assets/Cliffs_02/Rock_DarkCrackyCliffs_norm.jpg',
      '/Assets/Rock_04/Rock_sobermanRockWall_col.jpg',
      '/Assets/Rock_04/Rock_sobermanRockWall_norm.jpg',
      '/Assets/Mud_03/Ground_WetBumpyMud_col.jpg',
      '/Assets/Mud_03/Ground_WetBumpyMud_norm.jpg',
      '/Assets/Grass_020/ground_Grass1_col.jpg',
      '/hd/splatmap_00@0.5.png',
      '/hd/splatmap_01@0.5.png'
    ],
    [
      '/hd/heightmap.png',
      '/hd/normalmap_y.basis',
      '/simplex-noise.png',
      '/Assets/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg',
      '/Assets/Cliffs_02/Rock_DarkCrackyCliffs_norm.jpg',
      '/Assets/Rock_04/Rock_sobermanRockWall_col.jpg',
      '/Assets/Rock_04/Rock_sobermanRockWall_norm.jpg',
      '/Assets/Mud_03/Ground_WetBumpyMud_col.jpg',
      '/Assets/Mud_03/Ground_WetBumpyMud_norm.jpg',
      '/Assets/Grass_020/ground_Grass1_col.jpg',
      '/hd/splatmap_00.png',
      '/hd/splatmap_01.png'
    ]
  ])

  const [displacement, normal, noise, d1, n1, d2, n2, d3, n3, d4, splat1, splat2] = textures[highestQualityLoaded]

  const geometry = useRef();
  const [position, setPosition] = useState([2, 1]);

  const onUpdate = (e) => {
    // console.log(e.point);
    let { x, y } = e.point;
    [x, y] = [
      x + 1, -y
    ];

    setPosition([x, y]);
    // geometry.current.update(x, y);
  }

  return (
    <mesh onClick={onUpdate} position={[-1, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <dynamicBufferGeometry ref={geometry} args={[2, 2, ...position]} />
      {/* <planeBufferGeometry args={[1, 1, 2500, 2500]} /> */}
      {/* <meshStandardMaterial map={normal} wireframe side={DoubleSide} displacementMap={displacement} displacementScale={0.5} /> */}
      <SplatStandardMaterial
        side={DoubleSide}
        wireframe
        normalMap={normal}
        splats={[splat1, splat2]}
        normalMaps={[n1, n2, n3]}
        normalWeights={[0.75, 0.75, 0.75]}
        diffuseMaps={[d1, d2, d3, d4, d4, d3]}
        scale={[128 / 4, 128 / 2, 128, 128 * 2, 128, 128, 10]}
        saturation={[1.1, 1.1, 1.1, 1.2, 1.1, 1.1]}
        brightness={[0.0, 0.0, 0.0, -0.075, -0.075, 0.0]}
        noise={noise}
        displacementMap={displacement}
        displacementScale={0.3}
        envMapIntensity={0.5}
      />
    </mesh>
  )
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
