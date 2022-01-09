import { Canvas, extend, useThree, useFrame, createPortal, render } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture, useFBO, PerspectiveCamera, ScreenQuad, shaderMaterial, Billboard, Plane, useCamera } from '@react-three/drei'
import { Suspense, useEffect, useRef, useCallback, createRef, useState, useMemo } from 'react'
import UnindexedGeometry from './three-landscape/three/UnindexedGeometry';
import utils from './three-landscape/three/CBT/utils.js';
import { DoubleSide, BufferGeometry, BufferAttribute, Float32BufferAttribute, PlaneBufferGeometry, Vector2, Scene, Color, LinearMipMapLinearFilter, NearestFilter, LinearFilter, RGBAFormat, WebGLRenderTarget } from 'three';
import glsl from 'glslify';
import { EffectComposer, ShaderPass, SavePass, RenderPass } from "three-stdlib";
import { Flex, Box } from '@react-three/flex'
import get from 'lodash.get';

// Custom Shader Passes
import DataTexture from './three-landscape/three/CBT/DataTexture';
import SplitStep from './three-landscape/three/CBT/SplitStep';
import SumReduction from './three-landscape/three/CBT/SumReduction';

// extends
import RenderMaterial from './three-landscape/three/CBT/RenderMaterial';
import FullScreenSample from './three-landscape/three/CBT/FullScreenSample';
import Hud from './three-landscape/three/CBT/Hud';
import { Vector3 } from 'three';
extend({ EffectComposer, ShaderPass, SavePass, RenderPass })
extend({ UnindexedGeometry });
var s = 9;

// traditional geo based approach works at s=10, struggles at s=11
// s10 = 6.29M lines, d22 = 0.1M lines - 30K lines
// with tightest shouldSplit bound we should be able to render 2^8 triangles => effective detail equivalent to s14;
// from s10 -> s14 is a 16x increase in local detail

// d=22 is equivalent to s=10 (n/2 - 1.0)

// => can render 2k terrain @ 0.125

// we should see a perf gain at mesh subdivision of 2 of greater.

// Entry point
export function Level() {
  return (
    <Canvas linear style={{ background: 'black' }} camera={{ near: 0.001, position: [0, -0.05, 0.01] }}>
      <OrbitControls />
      <ambientLight intensity={1} />
      <Stats />

      <Suspense fallback={<Progress />}>
        {/* <fog attach="fog" args={['#74bbd0', 0, 200]} /> */}
        {/* <Terrain /> */}
        <TerrainComposer />
        {/* comparison mesh */}
        {/* <mesh position={[0, 0, -0.001]}>
          <planeBufferGeometry attach="geometry" args={[15, 15, 2 ** s, 2 ** s]} />
          <meshBasicMaterial attach="material" color="red" wireframe={true} />
        </mesh> */}


        {/* <HUD /> */}
      </Suspense>
    </Canvas>
  )
}

function HUD() {
  const cam = useRef(null);
  const { scene, size } = useThree();
  const r = 2.0;
  // todo add a zoom factor
  const target = useFBO(size.width / (r * 2), size.height / (r * 2));

  useFrame((state) => {
    state.gl.setRenderTarget(target)
    state.gl.render(scene, cam.current)
    state.gl.setRenderTarget(null)
  })
  return (
    <>
      <PerspectiveCamera ref={cam} position={[0, 0, 1.5]} />
      <mesh>
        <planeBufferGeometry attach="geometry" args={[1, 1, 1, 1]} />
        <hudMaterial r={r} map={target.texture} />
      </mesh>
    </>
  )
}

const eq3 = ([a1, a2, a3], [b1, b2, b3]) => a1 === b1 && a2 === b2 && a3 === b3;

const useGetRef = () => {
  const refs = useRef({})
  return useCallback(
    (idx) => (refs.current[idx] ??= createRef()),
    [refs]
  )
}


// max is 23 until problem with render material is fixed
// 18 is max w/o performance issues on camera movement
// 8 is a good paring for subdisivion
function TerrainComposer({ depth = 9, autoUpdate = false }) {

  const { gl, camera } = useThree()
  const subdivision = 0.0;
  depth = Math.min(depth, maxDepth(gl));
  const size = 2 ** (depth + 1); // size of cbt texture;
  const { width, height } = calculateSize(depth)
  const [leafCount, setLeafCount] = useState(4);

  const offset = new Vector3(0.5, 0.5, 0);
  const position = useRef(camera.position);

  const getRef = useGetRef();
  const composer = useRef();
  const [init, setInit] = useState(true);
  const renderTarget = useMemo(() => {
    return new WebGLRenderTarget(width, height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false
    })
  }, []);

  // update shader pass
  useFrame(() => {
    if (autoUpdate) update()

    // if (!eq3(position.current, camera.position.toArray())) {
    //   console.log('update');
    //   // getRef(0).current.uniforms.camera.value = camera.position.toArray();
    //   position.current = camera.position.toArray();
    //   // composer.current.render();
    // } else {
    //   position.current = camera.position.toArray();
    // }
  }, -1)

  useEffect(() => {
    setInit(true) // rerenders initial shader pass if shaders ect are updated
    // update(true);

    // click update
    if (!autoUpdate) {
      update(true);
      window.addEventListener('click', update);
    } else {
      window.addEventListener('click', printAllRenderTargets);
    }

  }, [size])


  const getXY = i => ({ x: (i % width), y: Math.floor(i / width) })

  const update = (print = false) => {

    composer.current.render()
    if (init) setInit(false) // now that the initial shader pass is rendered, set init to false

    // grab the number of leaves from the cbt texture
    const { x, y } = getXY(1);
    const rgba = sample2d(gl, renderTarget, x, y);
    const count = decode(rgba);
    if (count !== leafCount) setLeafCount(count);
    if (print) printAllRenderTargets();

  }

  const sampleRenderTarget = (gl, target, i) => {
    const { x, y } = getXY(i);
    const rgba = sample2d(gl, target, x, y);
    const value = decode(rgba);
    return value;
  }

  const printAllRenderTargets = () => {
    const targets = [renderTarget, get(composer, 'current.renderTarget1'), get(composer, 'current.renderTarget2')]
    targets.map(printRenderTarget);
    console.log('---')
  }

  const printRenderTarget = (target) => {
    const values = [];
    //first couple of values
    // for (let i = 0; i < 100; i++) {
    //   values.push(sampleRenderTarget(gl, target, i));
    // }
    //all values
    for (let i = 0; i < size; i++) {
      values.push(sampleRenderTarget(gl, target, i));
    }
    console.log(values);
  }

  const uniforms = {
    "uniforms-map-value": renderTarget.texture,
    "uniforms-depth-value": depth,
    "uniforms-size-value": size,
    "uniforms-width-value": width,
    "uniforms-height-value": height,
  }

  const sumReductionPasses = [];
  for (let i = depth; i >= 0; i--) {
    sumReductionPasses.push(
      <shaderPass
        attachArray="passes"
        key={i}
        args={[SumReduction]}
        uniforms-d-value={i}
        {...uniforms}
      />
    )
    sumReductionPasses.push(
      <savePass key={i + depth * 2} attachArray="passes" needsSwap={true} renderTarget={renderTarget} />
    )
  }

  const splitPasses = [];
  for (let i = depth - 1; i >= 0; i--) {
    splitPasses.push(
      <shaderPass
        attachArray="passes"
        ref={getRef(i)}
        key={i}
        args={[SplitStep]}
        uniforms-d-value={i}
        uniforms-camera-value={camera.position.clone().add(offset)}
        {...uniforms}
      />
    )
    splitPasses.push(
      <savePass key={i + depth} attachArray="passes" needsSwap={true} renderTarget={renderTarget} />
    )
  }

  const initialPass = (
    <shaderPass
      attachArray="passes"
      args={[DataTexture]}
      uniforms-depth-value={depth}
      uniforms-width-value={width}
      uniforms-height-value={height}
    />
  )

  return (
    <>
      {/* Render Texture test */}
      {/* <mesh>
        <planeBufferGeometry attach="geometry" args={[1, 1, 1, 1]} />
        <fullscreenSampleMaterial map={get(composer, 'current.renderTarget1')} />
      </mesh> */}

      {/* Render Grid */}
      {/* <PerspectiveCamera makeDefault fov={75} near={0.001} far={1000} position={[0, 0, 5]} /> */}
      <mesh position={[-0.5, -0.5, 0]} rotation={[0, 0, 0]}>
        <unindexedGeometry args={[leafCount * 2 ** subdivision]} />
        <renderMaterial
          side={DoubleSide}
          wireframe attach="material"
          cbt={renderTarget.texture}
          scale={15.0}
          size={size}
          width={width}
          height={height}
          subdivision={subdivision}
        />
      </mesh>
      {/* <mesh position={[0, 0, 0]}>
        <sphereBufferGeometry args={[0.05]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh> */}

      <effectComposer ref={composer} args={[gl, renderTarget]} renderToScreen={false}>
        {init && initialPass}
        {/* {initialPass} */}
        {splitPasses}
        {/* <shaderPass
          attachArray="passes"
          args={[SplitStep]}
          {...uniforms}
        />
        <savePass attachArray="passes" needsSwap={true} renderTarget={renderTarget} /> */}
        {sumReductionPasses}
        {/* <savePass attachArray="passes" needsSwap={true} renderTarget={renderTarget} /> */}
      </effectComposer>
    </>
  )
}

function sample(gl, renderTarget, i) {
  const pixelBuffer = new Uint8Array(4);
  gl.readRenderTargetPixels(renderTarget, i, 0, 1, 1, pixelBuffer);
  // pixelBuffer is a 4x8bit array of rgba values that can be converted to a 32bit value in the range 0 to 4,294,967,295 implying a max grid density of 2^16 x 2^16 
  const [r, g, b, a] = pixelBuffer;
  return [r, g, b, a];
}

function sample2d(gl, renderTarget, x, y) {
  const pixelBuffer = new Uint8Array(4);
  // console.log(x, y)
  gl.readRenderTargetPixels(renderTarget, x, y, 1, 1, pixelBuffer);
  // pixelBuffer is a 4x8bit array of rgba values that can be converted to a 32bit value in the range 0 to 4,294,967,295 implying a max grid density of 2^16 x 2^16 
  const [r, g, b, a] = pixelBuffer;
  return [r, g, b, a];
}

function decode(rgba) {
  const binaryString = rgba.map(x => x.toString(2).padStart(8, '0')).join('');
  return parseInt(binaryString, 2);
}

const maxTextureSize = gl => {
  const context = gl.getContext();
  const max = context.getParameter(context.MAX_TEXTURE_SIZE)
  return max;
}

// consider trying 3d textures
const maxDepth = gl => {
  const textureSize = maxTextureSize(gl);
  const total = Math.min(textureSize ** 2, 2 ** 32);
  let i = 0;
  while (2 ** (i + 1) < total) i++
  return i;
}

const calculateSize = (d) => {
  const width = 2 ** Math.ceil((d + 1) / 2);
  const height = 2 ** Math.floor((d + 1) / 2);
  return { width, height };
}

function Terrain({ d = 2 }) {
  const { camera, gl } = useThree()
  const size = 2 ** (d + 1); // size of cbt texture;
  const [leafCount, setLeafCount] = useState(4);

  // TODO: use d to initialize the CBT
  // length of a cbt is 2^(d+1)
  const BTree = useFBO(size, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false
  })

  BTree.mesh = () => (
    <mesh>
      <planeBufferGeometry attach="geometry" args={[1, 1, 1, 1]} />
      <updateMaterial attach="material" />
    </mesh>
  )

  const sceneB = useMemo(() => {
    const scene = new Scene()
    scene.background = new Color(0xffffff)
    return scene
  }, [])

  // trigger cbt update
  useFrame((state) => {

    // update the cbt
    state.gl.setRenderTarget(BTree)
    state.gl.render(sceneB, camera)
    state.gl.setRenderTarget(null)

    // grab the number of leaves from the cbt texture
    const rgba = sample(gl, BTree, 1);
    const count = decode(rgba);
    if (count !== leafCount) setLeafCount(count);
  })

  // render the raw data
  // return <BTree.mesh />

  return (
    <>
      {createPortal(<BTree.mesh />, sceneB)}
      <mesh>
        <unindexedGeometry args={[leafCount]} />
        <renderMaterial side={DoubleSide} wireframe attach="material" cbt={BTree.texture} size={size} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereBufferGeometry args={[0.05]} />
        <meshStandardMaterial color={0xffffff} />
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