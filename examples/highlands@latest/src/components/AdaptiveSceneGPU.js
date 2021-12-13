import { Canvas, extend, useThree, useFrame, createPortal, render } from '@react-three/fiber'
import { OrbitControls, Stats, Environment, useProgress, Html, useTexture, useFBO, Box, PerspectiveCamera, ScreenQuad, shaderMaterial } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import DynamicBufferGeometry, { update } from './three-landscape/three/DynamicPlaneGeometry';
import UnindexedGeometry from './three-landscape/three/UnindexedGeometry';
import { DoubleSide, BufferGeometry, BufferAttribute, Float32BufferAttribute, DataTexture, WebGLRenderTarget, PlaneBufferGeometry, Vector2, Scene, Color, LinearMipMapLinearFilter, NearestFilter, LinearFilter, RGBAFormat } from 'three';
import glsl from 'glslify';
import { ShaderPass, RenderPass, EffectComposer, SavePass } from "three-stdlib";
import get from 'lodash.get';

extend({ ShaderPass, RenderPass, EffectComposer, SavePass })

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
        <Derrain />
      </Suspense>
    </Canvas>
  )
}

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
      // gl_FragColor = vec4(vUv, 1.0,1.0);
    }
  `
  )
})


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


// skip initialization, manually set the data
const data = [
  1, 0, 0, 3 / 255, // 3
  0, 0, 0, 4 / 255, // 4
  0, 0, 0, 2 / 255, // 2
  1, 0, 0, 2 / 255, // 2
  0, 0, 0, 1 / 255, // 1
  0, 0, 0, 1 / 255, // 1
  0, 0, 0, 1 / 255, // 1
  1, 0, 0, 1 / 255, // 1
]

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

// generates data
const InitialMaterial = shaderMaterial(
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
extend({ InitialMaterial })

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
    precision highp float;
    ${utils}
    varying vec2 vUv;
    // uniform float data[${data.length}];
    uniform sampler2D data;
    void main() {
      // int index = int((vUv.x) * float(${data.length / 4}));
      
      // sample and operate on rgba values as if they were 32bit integers
      // vec4 a = vec4(0, 0, 0, 0.5);
      // vec4 b = vec4(0, 0, 0, 0.5);
      // vec4 col = a+ b;
      // int integerValue = decode(col);
      // vec4 rgba = encode(float(integerValue));


      gl_FragColor = texture2D(data, vUv) + vec4(0.5, 0.0, 0.0, 0.0);

      // sample data array
      // data array is a stand in for the cbt
      // gl_FragColor = vec4(
      //   data[index * 4],
      //   data[index * 4 + 1],
      //   data[index * 4 + 2],
      //   data[index * 4 + 3]
      // );

      // gl_FragColor = vec4(vUv, 0.0,1.0);
    }
  `
)
extend({ UpdateMaterial })



// uses textures to render data
const RenderMaterial = shaderMaterial(
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
extend({ RenderMaterial })

function useSwapBuffer(size, name) {
  const SwapBuffer = useFBO(size, 1, {
    multisampling: true,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false
  })
  // const texture = useTexture('/80px-Bounan_moutain.jpg')

  SwapBuffer.name = name;

  SwapBuffer.mesh = ({ init, source, initialRender }) => {
    console.log(name, initialRender, source)

    const Material = initialRender ?
      () => <initialMaterial attach="material" data={init} /> :
      () => <updateMaterial attach="material" data={source.texture} />;

    return (
      <mesh>
        <planeBufferGeometry attach="geometry" args={[1, 1, 1, 1]} />
        <Material />
      </mesh>
    )

  }

  SwapBuffer.scene = useMemo(() => {
    const scene = new Scene()
    scene.background = new Color(0xffffff)
    scene.autoUpdate = false;
    return scene
  }, [])

  return SwapBuffer;
}


// generates data
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
    precision highp float;
    ${utils}
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

      // gl_FragColor = vec4(vUv, 1.0,1.0);
    }
  `
}

const UpdateShader = {
  uniforms: {
    data: { value: undefined },
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
    uniform sampler2D data;
    void main() {     
      gl_FragColor = texture2D(data, vUv) + vec4(0.01, 0.0, 0.0, 0.0);
      // gl_FragColor = vec4(vUv, 1.0,1.0);
    }
  `
}



function Derrain({ d = 2 }) {
  const { camera, gl } = useThree()
  const size = 2 ** (d + 1); // size of cbt texture;
  const [leafCount, setLeafCount] = useState(2);

  const composer = useRef();
  const shaderPass = useRef();
  const [init, setInit] = useState(true);

  const renderTarget = useMemo(() => {
    return new WebGLRenderTarget(8, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false
    })
  }, []);

  useEffect(() => {
    setInit(true) // rerenders initial shader pass if shaders ect are updated
  }, [size])


  // update shader pass
  useFrame(() => {
    composer.current.render()
    if (init) setInit(false) // now that the initial shader pass is rendered, set init to false
  }, -1)


  return (
    <>
      <mesh>
        <planeBufferGeometry attach="geometry" args={[1, 1, 1, 1]} />
        <fullscreenSampleMaterial map={renderTarget.texture} />
      </mesh>
      <effectComposer ref={composer} args={[gl, renderTarget]} renderToScreen={false}>

        <shaderPass
          attachArray="passes"
          ref={shaderPass}
          args={[init ? InitialShader : UpdateShader]}
          uniforms-data-value={init ? data : renderTarget.texture} />

        {!init && <savePass attachArray="passes" needsSwap={true} renderTarget={renderTarget} />}
      </effectComposer>
    </>
  );


}

function Terrain({ d = 2 }) {
  const { camera, gl } = useThree()
  const size = 2 ** (d + 1); // size of cbt texture;
  const [leafCount, setLeafCount] = useState(4);

  const [initialRender, setInitialRender] = useState(true);

  // gl.domElement.getContext('webgl', { preserveDrawingBuffer: true, autoClear: true });


  // let A = useSwapBuffer(size, 'a');
  // let B = useSwapBuffer(size, 'b');

  const [swap, setSwap] = useState([useSwapBuffer(size, 'a', camera), useSwapBuffer(size, 'b', camera)]);
  const [A, B] = swap;

  // console.log(A.name, B.name)

  useEffect(() => {
    gl.setRenderTarget(A)
    gl.render(A.scene, camera)
    gl.setRenderTarget(null)

    gl.setRenderTarget(B)
    gl.render(B.scene, camera)
    gl.setRenderTarget(null)

    const rgba = sample(gl, A, 1);
    const count = decode(rgba);
    if (count !== leafCount) setLeafCount(count);

  }, [d])

  // swap buffers
  useEffect(() => {
    setSwap(swap => {
      const [A, B] = swap;
      return [B, A];
    });
    if (initialRender) setInitialRender(false);
  }, [d])

  // useFrame(({ clock }) => {
  //   console.log(clock)
  //   setSwap(swap => {
  //     const [A, B] = swap;
  //     return [B, A];
  //   });
  // }, [d])



  // trigger cbt update
  // useFrame((state) => {
  //   // console.log(active)

  //   state.gl.setRenderTarget(A)
  //   state.gl.render(sceneB, camera)

  //   // grab the number of leaves from the cbt texture
  //   const rgba = sample(gl, A, 1);
  //   const count = decode(rgba);
  //   if (count !== leafCount) setLeafCount(count);

  //   state.gl.setRenderTarget(null)
  // })

  // return null;

  // render the raw data

  const init = [
    0.5, 0, 0, 3 / 255, // 3
    0, 0, 0, 4 / 255, // 4
    0, 0, 0, 2 / 255, // 2
    0, 0, 0, 2 / 255, // 2
    0, 0, 0, 1 / 255, // 1
    0, 0, 0, 1 / 255, // 1
    0, 0, 0, 1 / 255, // 1
    0, 0, 0, 1 / 255, // 1
  ];



  // return <>
  //   {/* <A.mesh init={init} source={B} initialRender={initialRender} /> */}
  //   <B.mesh init={init} source={A} initialRender={initialRender} />
  // </>

  return (
    <>
      {createPortal(<A.mesh init={init} source={B} initialRender={initialRender} />, A.scene)}
      {/* {createPortal(<B.mesh init={init} source={A.texture} initialRender={initialRender} />, B.scene)} */}

      <A.mesh init={init} source={B} initialRender={initialRender} />

      {/* <B.mesh init={init} source={A} initialRender={initialRender} /> */}
      {/* <mesh>
        <unindexedGeometry args={[leafCount]} />
        <renderMaterial side={DoubleSide} wireframe attach="material" cbt={A.texture} size={size} />
      </mesh> */}
      {/* <mesh position={[0, 0, 0]}>
        <sphereBufferGeometry args={[0.05]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh> */}
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
