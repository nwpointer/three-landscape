import { Canvas, extend, useThree, useFrame, createPortal } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture, useFBO, Box, PerspectiveCamera, ScreenQuad, shaderMaterial } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import DynamicBufferGeometry, { update } from './three-landscape/three/DynamicPlaneGeometry';
import UnindexedGeometry from './three-landscape/three/UnindexedGeometry';
import { DoubleSide, BufferGeometry, BufferAttribute, Float32BufferAttribute, PlaneBufferGeometry, Vector2, Scene, Color, LinearMipMapLinearFilter, NearestFilter, LinearFilter, RGBAFormat, WebGLRenderTarget } from 'three';
import glsl from 'glslify';
import { EffectComposer, ShaderPass, SavePass, RenderPass } from "three-stdlib";
import get from 'lodash.get';

extend({ EffectComposer, ShaderPass, SavePass, RenderPass })

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
        {/* <Terrain /> */}
        <TerrainComposer />
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
DONE: prove i interpret a texture as a cbt and render it correctly
DONE: prove I can setup a recursive shader
DONE: implement level wise sum reduction

splitting and merging decisions can be done recursively overtime but sum reduction must be coherent for all renders

problem: sum reduction as initially conceived requires
  - atomic add
  - random writes up to the root (or) multiple passes, one per level

TODO::
- implement resolution independent sum reduction
- implement a split step either:
  - pass per leaf
  - pass per level
  - single pass?

PASS PER LEVEL:
sum reduction should be possible by level, but requires a separate shader run (pass uniforms d=total levels and i=level)
-> at max depth this implies like 27 ish passes, is that a problem? at least it scales linearly with depth
-> unsure if one pass that could read the entire cbt is worse than multiple passes (probably)

PASS PER LEAF / SINGLE PASS BY LEAF:
in a vertex shader for each leaf:
  - decide to split or merge
  - calculate up the tree neighbors that would be affected
  - store the effected neighbors in a varying array
  - update the neighbors in a fragment shader

  problem: the limit on varying size is small, 
    - so we'd need a bound on the number of affected neighbors
    - figure out how to insure that the right varying is associated with the right fragment


Question: sum reduction can be done bottom up - can splitting be done bottom up?
-> should be able to imbed a signal to split parent nodes by setting the current node to a value with a specific fractional value.
-> this would have the effect of essentially triggering an update on the parent node w/o need for random access write.
-> a cleanup pass or a subsequent render pass can clean up the fractional triggers.

+ all of this will work better if we can combine the sum reduction and splitting into one pass

if all of this fails we can always do splitting in js land and only use glsl for sum-reduction



*/

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
  float decode (vec4 col) {
    // ivec4 bytes = ivec4(col * 255.0);
    return (
      col.r * 255.0 * 255.0 * 255.0 * 255.0 +
      col.g * 255.0 * 255.0 * 255.0 +
      col.b * 255.0 * 255.0 +
      col.a * 255.0
    );
    // return ((bytes.r << 24) | (bytes.g << 16) | (bytes.b << 8) | (bytes.a));
  }
`;

// UpdateMaterial
extend({
  UpdateMaterial: shaderMaterial(
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
    precision highp float;
    ${utils}
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
})

// RenderMaterial
extend({
  RenderMaterial: shaderMaterial(
    { cbt: null, size: 3 },
    glsl`
    precision highp float;
    ${utils}
    varying vec2 vUv;
    uniform sampler2D cbt;
    uniform int size;
    vec3 Position;

    // assumes cbt is a 1d texture with values 0..n
    vec4 sampleCBT(float k){
      return texture2D(cbt, vec2(k/float(size), 0));
    }

    // // return the kth integer from a cbt of the specified size
    float getHeap(float k){
      return decode(sampleCBT(k));
    }

    // // get the heap index(ie k) of the lth leaf
    float leaf(float l) {
      float k = 1.0;
      while(getHeap(k) > 1.0) {
        if(l < getHeap(2.0 * k)) {
          k = 2.0 * k;
        }
        else {
          l = l - getHeap(2.0 * k);
          k = 2.0 * k + 1.0;
        }
      }
      return k;
    }

    mat3x3 square(int bit){
      int b = bit;
      int c = 1 - bit;

      return transpose(mat3x3(
        c, 0, b,
        b, c, b,
        b, 0, c
      ));
    }

    mat3x3 split(int bit){
      int b = bit;
      int c = 1 - bit;

      return transpose(mat3x3(
        c,   b,  0,
        0.5, 0,  0.5,
        0,   c,  b
      ));
    }

    mat3x3 winding(int bit){
      int b = bit;
      int c = 1 - bit;

      return mat3x3(
        c, 0, b,
        0, 1, 0,
        b, 0, c
      );
    }

    uint getBitValue(const uint bitField, int bitID){
      return ((bitField >> bitID) & 1u);
    }

    // walks tree and computes the matrix at the same time. Complicates things but no need to index into a bit-field which is hard todo in webgl. 
    mat3x3 computeMatrix(float l) {
      int depth = 1;
      float k = 1.0;

      // initialize the matrix
      mat3x3 matrix;
      if(l < getHeap(2.0)) {
        k = 2.0;
        matrix = (square(0));
      }
      else {
        l = l - getHeap(2.0);
        k = 3.0;
        matrix = square(1);
      }

      // traverse the tree
      while(getHeap(k) > 1.0) {
        if(l < getHeap(2.0 * k)) {
          k = 2.0 * k;
          matrix = split(0) * matrix;
        }
        else {
          l = l - getHeap(2.0 * k);
          k = 2.0 * k + 1.0;
          matrix = split(1) * matrix;
        }
        depth++;
      }
      matrix = winding((depth ^ 1) & 1) * matrix;
      return matrix;
    }

    void main() {
      vUv = uv;
      float index = floor(float(gl_VertexID) / 3.0);
      float vertex = mod(float(gl_VertexID), 3.0);

      mat3x3 matrix = computeMatrix(index);

      mat2x3 faceVertices = mat2x3(vec3(0, 0, 1), vec3(1, 0, 0));
      faceVertices = matrix * faceVertices;


      Position = vec3(faceVertices[0][int(vertex)], faceVertices[1][int(vertex)], 0);

      // Position.y += 0.5 * floor(index / 2.0) * 2.0; // test that indexing works

      // float k = leaf(index); // get the index of th ith leaf in cbt texture
      // float value = getHeap(k); // get integer value of leaf

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
})

// FullscreenSampleMaterial
extend({
  FullscreenSampleMaterial: shaderMaterial(
    {
      map: undefined
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
    varying vec2 vUv;
    uniform sampler2D map;
    void main() {
      gl_FragColor = texture2D(map, vUv);
      // gl_FragColor = vec4(vUv, 0.0,1.0);
    }
  `
  )
})


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

// data to texture shader
const InitialShader = {
  uniforms: {
    data: { value: data },
  },
  vertexShader: glsl`
    varying vec2 vUv;
    void main() {
      gl_Position = vec4(position * 1.0, 1.0);
      vUv = uv;
    }
  `,
  fragmentShader: glsl`
    varying vec2 vUv;
    uniform float data[${data.length}];
    void main() {
      int index = int((vUv.x) * float(${data.length / 4}));
      gl_FragColor = vec4(
        data[index * 4],
        data[index * 4 + 1],
        data[index * 4 + 2],
        data[index * 4 + 3]
      );

      // exaggerate the alpha channel and send it to the red so its visible
      // gl_FragColor = vec4(gl_FragColor.a * 50.0, 0,0, gl_FragColor.a);

      // gl_FragColor = vec4(vUv, 1.0,1.0);
    }
  `
}

const UpdateShader = (len = 2) => ({
  uniforms: {
    data: { value: undefined },
    delta: { value: undefined },
    size: { value: undefined },
    d: { value: undefined },
  },
  vertexShader: glsl`
    varying vec2 vUv;
    varying float x[${len}];
    void main() {
      gl_Position = vec4(position * 1.0, 1.0);
      vUv = uv;
      x[${len - 1}] = 0.1;
    }
  `,
  fragmentShader: glsl`
    varying vec2 vUv;
    varying float x[${len}];
    uniform sampler2D data;
    uniform sampler2D delta;
    uniform float size;
    uniform float d;
    void main() {
      float a = texture2D(data, vUv).a;
      int index = int(vUv.x * size);
      gl_FragColor = texture2D(data, vUv); // do noting

      
      // determining if is leaf is easy, if its value=0 in the range 2^d ... 2^(d+1), then it is a leaf
      bool isLeaf = a==1.0 / 255.0 && index >= int(pow(2.0,d));

      if(texture2D(delta, vUv).a == 1.0){
        gl_FragColor.b += x[${len - 1}];
      }
      
      
      if(isLeaf) {
        // gl_FragColor.b += 0.3;
        // follow path to root, increasing by one 
      }

      // problem - because we're using gl_FrgColor to write, we have random access to read values but not to write them



      // gl_FragColor = texture2D(data, vUv) + vec4(0.05, 0.0, 0.0, 0.0);
      // gl_FragColor = vec4(vUv, 1.0,1.0);
    }
  `
})

function TerrainComposer({ depth = 2 }) {
  const { camera, gl } = useThree()
  const size = 2 ** (depth + 1); // size of cbt texture;
  const [leafCount, setLeafCount] = useState(4);

  const composer = useRef();
  const [init, setInit] = useState(true);
  const renderTarget = useMemo(() => {
    return new WebGLRenderTarget(8, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false
    })
  }, []);

  const updateTarget = useMemo(() => {
    return new WebGLRenderTarget(8, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false
    })
  }, []);

  useEffect(() => {
    // console.log(gl.getContext('webgl2'));
    setInit(true) // rerenders initial shader pass if shaders ect are updated

    console.log(get(composer, 'current.readBuffer'))

    // click update
    update();
    window.addEventListener('click', update);

  }, [size])

  // update shader pass
  // useFrame(() => {
  //   update();
  // }, -1)

  const update = () => {

    composer.current.render()
    if (init) setInit(false) // now that the initial shader pass is rendered, set init to false

    // grab the number of leaves from the cbt texture
    const rgba = sample(gl, renderTarget, 1);
    const count = decode(rgba);
    if (count !== leafCount) setLeafCount(count);
  }

  const data = [
    0, 0, 0, 3 / 255, // 3
    0, 0, 0, 0 / 255, // 4
    0, 0, 0, 0 / 255, // 2
    0, 0, 0, 0 / 255, // 2
    0, 0, 0, 1 / 255, // 1
    0, 0, 0, 0 / 255, // 1
    0, 0, 0, 1 / 255, // 1
    0, 0, 0, 0 / 255, // 1
  ]

  const sumReductionPasses = [];
  for (let i = depth - 1; i >= 0; i--) {
    sumReductionPasses.push((
      <>
        <shaderPass
          attachArray="passes"
          args={[SumReductionPass]}
          uniforms-map-value={renderTarget.texture}
          uniforms-depth-value={depth}
          uniforms-size-value={size}
          uniforms-d-value={i}
        />
        <savePass attachArray="passes" needsSwap={true} renderTarget={renderTarget} />
      </>
    ));
  }

  const initialPass = (
    <shaderPass
      attachArray="passes"
      args={[InitialShader]}
      uniforms-data-value={data}
    />
  )

  return (
    <>
      {/* Render Texture test */}
      {/* <mesh>
        <planeBufferGeometry attach="geometry" args={[1, 1, 1, 1]} />
        <fullscreenSampleMaterial map={renderTarget.texture} />
      </mesh> */}

      {/* Render Grid */}
      <mesh>
        <unindexedGeometry args={[leafCount]} />
        <renderMaterial side={DoubleSide} wireframe attach="material" cbt={renderTarget.texture} size={size} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereBufferGeometry args={[0.05]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>

      {/* Coherent */}
      <effectComposer ref={composer} args={[gl, renderTarget]} renderToScreen={false}>
        {initialPass}
        {sumReductionPasses}
      </effectComposer>

      {/* Phased, onclick or onFrame */}
      {/* <effectComposer ref={composer} args={[gl, renderTarget]} renderToScreen={false}>
        {init ? initialPass : sumReductionPasses}
      </effectComposer> */}
    </>
  )
}

const SumReductionPass = ({
  uniforms: {
    map: { value: undefined },
    size: { value: undefined },
    depth: { value: undefined },
    d: { value: undefined },
  },
  vertexShader: glsl`
    varying vec2 vUv;
    void main() {
      gl_Position = vec4(position * 1.0, 1.0);
      vUv = uv;
    }
  `,
  fragmentShader: glsl`
    varying vec2 vUv;
    uniform sampler2D map;
    uniform float depth;
    uniform float size;
    uniform float d;
    float z = 2.0;
    
    void main() {
      gl_FragColor = texture2D(map, vUv);

      float index = floor((vUv.x) * 8.0) ;
      if(index >= pow(2.0, (d)) && index < pow(2.0, (d+1.0))) {
        // gl_FragColor.b += 0.1;
        float l = index * 2.0;
        float r = index * 2.0 + 1.0;

        vec4 leftChild = texture2D(map, vec2(l / size, vUv.y));
        vec4 rightChild= texture2D(map, vec2(r / size, vUv.y));

        // make visible
        // gl_FragColor.r = leftChild.r + rightChild.r;
        
        gl_FragColor.a = leftChild.a + rightChild.a;
      }      
    }
  `
})

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
