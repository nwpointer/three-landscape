import { Canvas, extend, useThree, useFrame, createPortal } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture, useFBO, Box, PerspectiveCamera, ScreenQuad, shaderMaterial } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import DynamicBufferGeometry, { update } from './three-landscape/three/DynamicPlaneGeometry';
import UnindexedGeometry from './three-landscape/three/UnindexedGeometry';
import { DoubleSide, BufferGeometry, BufferAttribute, Float32BufferAttribute, PlaneBufferGeometry, Vector2, Scene, Color, LinearMipMapLinearFilter, NearestFilter, LinearFilter, RGBAFormat } from 'three';
import glsl from 'glslify';

extend({ DynamicBufferGeometry }); // old, cpu based code
extend({ UnindexedGeometry });
export function Level() {

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




// textureBuffer
/*
initialize a texture as CBT
(may need two swap textures to read and write from cbt?)

n = sample CBT[1]
update(x,y): for 0..n
  find CBT(n)
  compute transform
  split on condition f(x,y)
  merge on condition f(x,y)
  sum-reduce the CBT as a whole or only the changed parts (?)

n` = sample CBT[1]
render(): for 0..n`
  find CBT(n)
  compute transform
  write co-ordinates to vertexTexture(?)

  set v = vertexTexture(n)
  ignore uv, derive from v

*/

/*
DONE: prove i can read / write 32bit values from a texture

skip update by creating a texture of size 2^d+1
  write d,2,1,1 to the texture
  alternatively write d,4,2,2,1,1,1,1

  n=CBT[1]
  path = find(n)
  position = transform(path)

*/

// const data = [
//   // 0, 0, 1,
//   // 0, 0, 0,
//   // 1, 0, 0,
//   // 1, 0, 0,
//   // 1, 0, 1,
//   // 0, 0, 1,

//   1, 0, 0,
//   0.5, 0, 0.5,
//   0, 0, 0,

//   0, 0, 0,
//   0.5, 0, 0.5,
//   0, 0, 1,

//   0, 0, 1,
//   0.5, 0, 0.5,
//   1, 0, 1,

//   1, 0, 1,
//   0.5, 0, 0.5,
//   1, 0, 0,
// ]

// skip initialization, manually set the data
const data = [
  0, 0, 0, 3 / 255, // 3
  0, 0, 0, 4 / 255, // 4
  0, 0, 0, 2 / 255, // 2
  0, 0, 0, 2 / 255, // 2
  0, 0, 0, 1 / 255, // 1
  0, 0, 0, 1 / 255, // 1
  0, 0, 0, 1 / 255, // 1
  0, 0, 0, 1 / 255, // 1
]

const utils = glsl`
  // encodes a 32bit value into a 4x8bit array of rgba values
  vec4 encode( float value ){
    value /= 4294967040.0;
    value *= (256.0*256.0*256.0 - 1.0) / (256.0*256.0*256.0);
    vec4 encode = fract( value * vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0) );
    return vec4( encode.xyz - encode.yzw / 256.0, encode.w ) + 1.0/512.0;
  }

  // returns a 32 bit integer value encoded in a vec4
  int decode (vec4 col) {
    ivec4 bytes = ivec4(col);
    return (bytes.r << 24) | (bytes.g << 16) | (bytes.b << 8) | (bytes.a);
  }
`;

// generates data
const UpdateMaterial = shaderMaterial(
  {
    data: data
  },
  glsl`
    varying vec2 vUv;
    void main() {
      // gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      gl_Position = vec4(position * 2.0, 1.0);
      vUv = uv;
    }
  `,
  glsl`
    ${utils}
    precision highp float;
    varying vec2 vUv;
    uniform float data[${data.length}];
    void main() {
      int index = int((vUv.x) * float(${data.length / 4}));
      
      // sample and operate on rgba values as if they were 32bit integers
      // vec4 a = vec4(0, 0, 0, 0.5);
      // vec4 b = vec4(0, 0, 0, 0.5);
      // vec4 col = a+ b;
      // int integerValue = decode(col);
      // vec4 rgba = encode(float(integerValue));

      // sample data array
      // data array is a stand in for the cbt
      gl_FragColor = vec4(
        data[index * 4],
        data[index * 4 + 1],
        data[index * 4 + 2],
        data[index * 4 + 3]
      );

      // gl_FragColor = vec4(vUv, 1.0,1.0);
    }
  `
)
extend({ UpdateMaterial })

// uses textures to render data
const RenderMaterial = shaderMaterial(
  { cbt: null, size: 3 },
  glsl`
    ${utils}
    varying vec2 vUv;
    uniform sampler2D cbt;
    uniform int size;
    vec3 Position;

    // assumes cbt is a 1d texture with values 0..n
    vec4 sampleCBT(int k){
      return texture2D(cbt, vec2(float(k)/float(size), 0));
    }

    // return the kth integer from a cbt of the specified size
    int getHeap(int k){
      return decode(sampleCBT(k));
    }

    // get the heap index(ie k) of the lth leaf
    int getLeaf(int l) {
      int k = 1;
      while(getHeap(k) > 0) {
        if(l < getHeap(2 * k)) {
          k = 2 * k;
        }
        else {
          l = l - getHeap(2 * k);
          l = 2 * k + 1;
        }
      }
      return k;
    }
    
    // 0,1,2,3
    // 

    void main() {
      vUv = uv;
      int index = int(floor(float(gl_VertexID) / 3.0));
      int vertex = int(mod(float(gl_VertexID), 3.0));
      // int leaf = getLeaf(index);

      // int k = leaf(index); // get the index of th ith leaf in cbt texture
      // int value = value(k) // get integer value of leaf
      // Position = triangle(value); // get the position of the ith leaf


      // Prove we can create triangle and shift based on index
      if(vertex == 0) {
        Position = vec3(0, 0, 0);
      }
      if(vertex == 1) {
        Position = vec3(0.5, 0, 0);
      }
      if(vertex == 2) {
        Position = vec3(0.5, 0.5, 0);
      }

      Position.y += 0.5 * float(index);
      vec4 color = texture2D(cbt, vec2(1/size,0.0));
      float value = float(size);
      vec4 bias = vec4(0, 0, 0, value);
      Position.x += 0.5 * float(decode(bias));

      // old code for sampling position from a texture
      // Position = texture2D(cbt, vec2(float(gl_VertexID)/6.0, 0.0 ));
      // Position.xz -= 0.5;
      // Position.xz *= 4.0;
      
      gl_Position = projectionMatrix * modelViewMatrix *  vec4(Position, 1.0);
    }
  `,
  glsl`
    varying vec2 vUv;
    uniform sampler2D cbt;
    void main() {
      // gl_FragColor = vec4(texture2D(map, vUv).rgb,1.0);
      gl_FragColor = vec4(1.0,0.0,0.0,1.0);
    }
  `
)
extend({ RenderMaterial })

// function geo() {
//   const geometry = new BufferGeometry();
//   const vertices = new Float32Array([
//     -1.0, -1.0, 1.0,
//     1.0, -1.0, 1.0,
//     1.0, 1.0, 1.0,

//     1.0, 1.0, 1.0,
//     -1.0, 1.0, 1.0,
//     -1.0, -1.0, 1.0
//   ]);

//   geometry.setAttribute('position', new BufferAttribute(vertices, 3));

//   return geometry;
// }

function sample(gl, renderTarget, i) {
  const pixelBuffer = new Uint8Array(4);
  gl.readRenderTargetPixels(renderTarget, i, 0, 1, 1, pixelBuffer);
  // pixelBuffer is a 4x8bit array of rgba values that can be converted to a 32bit value in the range 0 to 4,294,967,295 implying a max grid density of 2^16 x 2^16 
  const [r, g, b, a] = pixelBuffer;
  return [r, g, b, a];
}

function decode(rgba) {
  const binaryString = rgba.map(x => x.toString(2).padStart(8, '0')).join('');
  return parseInt(binaryString, 2);
}

function Terrain({ d = 2 }) {
  const { camera, gl } = useThree()
  const size = 2 ** (d + 1); // size of cbt texture;
  const [leafCount, setLeafCount] = useState(2);

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

    state.gl.setRenderTarget(BTree)
    state.gl.render(sceneB, camera)

    // grab the number of leaves from the cbt texture
    const rgba = sample(gl, BTree, 1);
    const count = decode(rgba);
    if (count !== leafCount) setLeafCount(count);

    // console.log(sample(gl, BTree, 0));

    state.gl.setRenderTarget(null)
  })

  // render the raw data
  return <BTree.mesh />


  return (
    <>
      {createPortal(<BTree.mesh />, sceneB)}
      <mesh>
        {/* drawRange={{ start: 0, count: 12 }} */}
        <unindexedGeometry args={[leafCount]} />
        <renderMaterial side={DoubleSide} wireframe attach="material" map={BTree.texture} size={size} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereBufferGeometry args={[0.05]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>
      {/* 
      <mesh rotation={[-0.0 * Math.PI, 0, 0]}>
        <circleBufferGeometry attach="geometry" args={[0.5, 40]} />
        <renderMaterial side={DoubleSide} wireframe attach="material" map={BTree.texture} />
      </mesh> */}
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
