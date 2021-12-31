import utils from './utils.js';
import glsl from 'glslify';

// Split or Merge shader
const SplitStep = ({
  uniforms: {
    map: { value: undefined },
    depth: { value: undefined },
    size: { value: undefined },
    width: { value: undefined },
    height: { value: undefined }
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
    uniform float width;
    uniform float height;
    float z = 2.0;

    ${utils}

    bool isEven(float node){
      return mod(node, 2.0) == 0.0;
    }

    float sibling(float node){
      if(isEven(node)){
        return node + 1.0;
      } else {
        return node - 1.0;
      }
    }

    void main() {
      gl_FragColor = texture2D(map, vUv);
      float index = getIndex(vUv);

      if(shouldSplit(parent(index))) gl_FragColor = encode(1.0);
      if(shouldSplit(edge(parent(index)))) gl_FragColor = encode(1.0);
      if(shouldSplit(edge(sibling(index)))) gl_FragColor = encode(1.0);

      // maybe this works?
      if(shouldMerge(parent(index))) gl_FragColor = vec4(0,0,0, 0.0 / 255.0);
      if(shouldMerge(edge(parent(index)))) gl_FragColor = vec4(0,0,0, 0.0 / 255.0);
      if(shouldMerge(edge(sibling(index)))) gl_FragColor = vec4(0,0,0, 0.0 / 255.0);
      

      // gl_FragColor = encode(index);

      if(index == 0.0) {
        gl_FragColor = encode(depth);
      }
      // if(index == 1.0) {
      //   gl_FragColor = encode(depth);
      // }
      // if(index == 2.0) {
      //   gl_FragColor = encode(depth);
      // }
      // if(index == 3.0) {
      //   gl_FragColor = encode(depth);
      // }
      // if(index == 4.0) {
      //   gl_FragColor = encode(depth);
      // }
      // if(index == 5.0) {
      //   gl_FragColor = encode(depth);
      // }
      // if(index == 6.0) {
      //   gl_FragColor = encode(depth);
      // }
      // if(index == 7.0) {
      //   gl_FragColor = encode(7.0);
      // }

      // if(index == 1.0) {
      //   gl_FragColor = encode(2.0);
      // }

    }
  `
})

export default SplitStep;