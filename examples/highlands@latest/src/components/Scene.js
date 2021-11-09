import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useDetectGPU } from '@react-three/drei'
import { Suspense } from 'react'
import { Skybox } from './Skybox'

import { SplatStandardMaterial } from './three-landscape/SplatMaterial'
import { useProgressiveTextures } from './three-landscape/useProgressiveTexture'

export function Scene() {
  return (
    <Canvas linear style={{ background: 'black' }}>
      <OrbitControls />
      <ambientLight intensity={0.1} />
      <directionalLight intensity={0.1} />
      <Stats />
      <Suspense fallback={<Progress />}>
        <Skybox fog={false} />
        <Environment preset="park" rotation={[0, Math.PI / 2, 0]} />
        <fog attach="fog" args={['#74bbd0', 0, 200]} />
        <Terrain />
      </Suspense>
    </Canvas>
  )
}


const Terrain = () => {
  const GPUTier = useDetectGPU()
  const lowPowerDevice = GPUTier.tier === '0' || GPUTier.isMobile
  const detail = lowPowerDevice ? 32 : 8
  const [highestQualityLoaded, textures] = useProgressiveTextures([
    [
      '/hd/heightmap.png',
      '/hd/normalmap@0.5.png',
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
      '/hd/normalmap.png',
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

  const { width, height } = displacement.image

  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeBufferGeometry args={[100, 100, width / detail, height / detail]} />
      <SplatStandardMaterial
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
        displacementScale={10}
        displacementBias={-10}
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
