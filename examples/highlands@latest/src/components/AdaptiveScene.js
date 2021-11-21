import { Canvas, extend } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture } from '@react-three/drei'
import { Suspense } from 'react'
import DynamicBufferGeometry from './three-landscape/three/DynamicPlaneGeometry';
import { DoubleSide } from 'three';
import { BinaryHeap } from './three-landscape/three/BinaryHeap';

extend({ DynamicBufferGeometry });

export function Scene() {
  return (
    <Canvas linear style={{ background: 'black' }}>
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

const Terrain = () => {
  const texture = useTexture('/hd/normalmap.png')
  const height = useTexture('/hd/heightmap.png')

  return (
    <mesh position={[-1, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <dynamicBufferGeometry args={[2, 2]} />
      <meshStandardMaterial map={texture} wireframe side={DoubleSide} displacementMap={height} displacementScale={0.5} />
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
