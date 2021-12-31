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

        if(index >= pow(2.0, (depth)) && index < pow(2.0, (depth+1.0))) {
          gl_FragColor = encode(1.0);
        }
  
        // float d = depth;
        // while(d>=0.0){
        //   if(index >= pow(2.0, (d)) && index < pow(2.0, (d+1.0))){
        //     gl_FragColor = encode(d);
        //     d = -1.0;
        //   }
        //   d= d-1.0;
        // }
  
        // if(index >= pow(2.0, (depth)) && index < pow(2.0, (depth+1.0))) {
        //   vec4 v = encode(4.0);
        //   gl_FragColor = v;
        // }
  
        // gl_FragColor = vec4(vUv, 1.0,1.0);
      }
    `
});

export default DataTexture;