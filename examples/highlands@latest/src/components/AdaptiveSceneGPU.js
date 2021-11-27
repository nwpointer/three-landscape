import { Canvas, extend, useThree, useFrame, createPortal } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture, useFBO, Box, PerspectiveCamera, ScreenQuad, shaderMaterial } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import DynamicBufferGeometry, { update } from './three-landscape/three/DynamicPlaneGeometry';
import { DoubleSide, Float32BufferAttribute, PlaneBufferGeometry, Vector2, Scene, Color, LinearMipMapLinearFilter, NearestFilter, LinearFilter } from 'three';

extend({ DynamicBufferGeometry });

export function Level() {

  return (
    <Canvas linear style={{ background: 'black' }}>
      <OrbitControls />
      <ambientLight intensity={1} />
      <Stats />
      <Suspense fallback={<Progress />}>
        <fog attach="fog" args={['#74bbd0', 0, 200]} />
        {/* <ScreenQuadScene /> */}
        <Terrain />
      </Suspense>
    </Canvas>
  )
}

// generates data
const SourceMaterial = shaderMaterial(
  {
    vertexId: new Array(18).fill(0).map((_, i) => i),
    data: [
      0, 0, 2,
      0, 0, 0,
      2, 0, 0,
      2, 0, 0,
      2, 0, 2,
      0, 0, 2,
    ]
  },
  `
    varying vec3 v_position;
    void main() {
      gl_Position = vec4(position, 1.0);
      v_position = position;
    }
  `,
  `
    varying vec3 v_position;
    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      gl_FragColor = vec4(rand(v_position.xy), rand(v_position.xy), rand(v_position.xy),1.0);
    }
  `
)
extend({ SourceMaterial })

// uses textures to render data
const MeshMaterial = shaderMaterial(
  { map: null },
  `
    varying vec2 vUv;
    uniform sampler2D map;
    vec3 Position;

    float rand(vec2 co){
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vUv = uv;

      // vertical displacement
      Position = position + vec3(texture2D(map, vUv) * 0.2);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4( Position, 1.0 );
      
    }
  `,
  `
    varying vec2 vUv;
    uniform sampler2D map;
    void main() {
      // gl_FragColor = vec4(texture2D(map, vUv).rgb,1.0);
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `
)
extend({ MeshMaterial })

// 0, 0, 2, 
// 0, 0, 0, 
// 2, 0, 0,
// 2, 0, 0, 
// 2, 0, 2, 
// 0, 0, 2,

// 0, 0, 0, 
// 1, 0, 1, 
// 0, 0, 2,
//
// 2, 0, 0, 
// 1, 0, 1, 
// 0, 0, 0,
//
// 2, 0, 2, 
// 1, 0, 1, 
// 2, 0, 0,
//
// 0, 0, 2, 
// 1, 0, 1, 
// 2, 0, 2,


// need to figure out how to encode a texture with the above data
// need to figure out how to render the correct number of triangles (1 * leaf count)
// need to figure out how to trigger a re-render when the data changes
// split / merge
// sum-reduction
// debugging will be tricky


function Terrain() {
  const { camera } = useThree()
  const scene = useMemo(() => {
    const scene = new Scene()
    scene.background = new Color(0xffffff)
    return scene
  }, [])
  const target = useFBO()

  const mesh = useRef();

  console.log(mesh);

  target.texture.magFilter = NearestFilter
  target.texture.minFilter = NearestFilter

  useFrame((state) => {
    target.setSize(9, 9) // this one matters

    state.gl.setRenderTarget(target)
    state.gl.render(scene, camera)
    state.gl.setRenderTarget(null)
  })

  return (
    <>
      {createPortal(
        <ScreenQuad>
          <sourceMaterial attach="material" />
        </ScreenQuad>,
        scene
      )}
      <mesh>
        <planeBufferGeometry attach="geometry" drawRange={{ start: 0, count: 99 }} args={[1, 1, 9, 9]} />
        <meshMaterial ref={mesh} wireframe attach="material" map={target.texture} />
      </mesh>
    </>
  )
}

const Progress = () => {
  const state = useProgress()

  return (
    <Html center>
      <div style={{ border: '1px solid white', height: '10px', width: '100px' }}>
        <div style={{ background: 'white', height: '10px', width: `${state.progress} px` }} />
      </div>
    </Html>
  )
}
