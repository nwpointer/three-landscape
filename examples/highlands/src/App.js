import React, { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { ResizeObserver as Polyfill } from '@juggle/resize-observer'
window.ResizeObserver = window.ResizeObserver || Polyfill

import { Box } from './components/Box'
import { Skybox } from './components/Skybox'
import { Loading } from './components/Loading'
import { Terrain } from 'three-landscape'

export default function App() {
  const root = '/maps/CustomTerrainShape'
  return (
    <Canvas camera={{ fov: 50, far: 6000 }}>
      <ambientLight intensity={0.5} />
      <Box position={[-1.2, 0, 0]} />
      <Box position={[1.2, 0, 0]} />

      <OrbitControls maxDistance={2000} />

      <Suspense fallback={<Loading />}>
        <Skybox fog={false} />
        <Environment preset="park" rotation={[0, Math.PI / 2, 0]} />
        <fog attach="fog" args={['#74bbd0', 0, 2000]} />
        <Terrain
          envMapIntensity={0.5}
          metalness={1}
          displacement={`${root}/heightmap.jpg`}
          displacementScale={100}
          displacementBias={-60}
          normalScale={new THREE.Vector2(1.5, 2)}
          normal={`${root}/normalmap-y-hd.jpg`}
          splats={[`${root}/splatmap_00.tga`, `${root}/splatmap_01.tga`]}
          tiles={[
            {
              diffuse: `${root}/Assets/Cliffs_02/Rock_DarkCrackyCliffs_col.png`,
              normal: `${root}/Assets/Cliffs_02/Rock_DarkCrackyCliffs_norm.png`
            },
            {
              diffuse: `${root}/Assets/Rock_04/Rock_sobermanRockWall_col.png`,
              normal: `${root}/Assets/Rock_04/Rock_sobermanRockWall_norm.png`
            },
            {
              diffuse: `${root}/Assets/Mud_03/Ground_WetBumpyMud_col.png`,
              normal: `${root}/Assets/Mud_03/Ground_WetBumpyMud_norm.png`
            },
            {
              diffuse: `${root}/Assets/Grass_020/ground_Grass1_col.png`
            }
          ]}
          layers={[
            {
              diffuse: { tile: 0, repeat: [23.5252656529, 23.5252656529] },
              normal: { tile: 0, repeat: [23.5252656529, 23.5252656529], splat: 1, weight: 0.5 }
            },
            {
              diffuse: { tile: 1, repeat: [21.7732806125, 21.7732806125] },
              normal: { tile: 1, repeat: [256, 256], weight: 0.5 }
            },
            {
              diffuse: { tile: 2, repeat: [256, 256] },
              normal: { tile: 2, repeat: [256, 256] }
            },
            {
              diffuse: { tile: 3, repeat: [256, 256], saturation: 1.1 }
            },
            {
              diffuse: { tile: 3, repeat: [256, 256], saturation: 1.25 }
            },
            {
              diffuse: { tile: 2, repeat: [256, 256] },
              normal: { tile: 2, repeat: [256, 256], weight: 0.5 }
            }
          ]}
        />
      </Suspense>
    </Canvas>
  )
}
