import utils from './utils.js';
import glsl from 'glslify';

const DataTexture = ({
  uniforms: {
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
      uniform float depth;
      uniform float size;
      uniform float width;
      uniform float height;
  
      ${utils}

  
      void main() {
        float index = getIndex(vUv);
        // gl_FragColor = encode(index / 2.0);

        // total splitting
        // if(index >= pow(2.0, (depth)) && index < pow(2.0, (depth+1.0))) {
        //   gl_FragColor = encode(1.0);
        // }


        // minimal splitting, insures 2&3 = 1 if sum-reduction occurs. All tree should be correct down to depth
        if(index == pow(2.0, (depth))){
          gl_FragColor = encode(1.0);
        }
        float width = pow(2.0, (depth+1.0)) - pow(2.0, (depth));
        if(index == pow(2.0, (depth)) + width/2.0){
          gl_FragColor = encode(1.0);
        }

        // split at level d - does not update below level d
        // float d = min(depth, 4.0);
        // if(index >= pow(2.0, (d)) && index < pow(2.0, (d+1.0))) {
        //   gl_FragColor = encode(1.0);
        // }

        if(index == 0.0) {
          gl_FragColor = encode(depth);
        }

      }
    `
});

export default DataTexture;