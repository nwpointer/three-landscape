import utils from './utils.js';
import glsl from 'glslify';

// Sum reduction shader
const SumReduction = ({
  uniforms: {
    map: { value: undefined },
    depth: { value: undefined },
    d: { value: undefined },
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
    uniform float d;
    float z = 2.0;

    ${utils}

    void main() {
      gl_FragColor = texture2D(map, vUv);
      float index = getIndex(vUv);

      
      // gl_FragColor = encode(5.0);



      // if(index == 16.0){
      //   float leftIndex = (index * 2.0) ;
      //   float rightIndex = (index * 2.0 + 1.0);
  
      //   vec4 leftChild  = sampleCBT(leftIndex);
      //   vec4 rightChild = sampleCBT(rightIndex);
      //   gl_FragColor = encode(decode(rightChild));
      // }
    

      
      if(index >= pow(2.0, (d)) && index < pow(2.0, (d+1.0))) {
        float leftIndex = (index * 2.0);
        float rightIndex = (index * 2.0 + 1.0);

        vec4 leftChild  = sampleCBT(leftIndex);
        vec4 rightChild = sampleCBT(rightIndex);

        float sum = decode(leftChild) + decode(rightChild);
        float current = decode(gl_FragColor);

        // gl_FragColor = encode(rightIndex);

        gl_FragColor = encode(max(sum, current));

        // if(shouldSplit(index)) gl_FragColor = encode(left);

        // if(shouldSplit(index)) gl_FragColor = encode(rightIndex);

        
        // if(shouldSplit(index)) gl_FragColor = encode(5.0);
        // look for descendent that should split
        // float x = edge(index);
        // float xx = edge(left(index));
        // float y = edge(index);
        // float yy = edge(right(index));
        // float n = 0.0;
        // while(n < (depth-d)){
        //   if(shouldSplit(x)) gl_FragColor = vec4(0,0,0, 2.0 / 255.0);
        //   if(shouldSplit(xx)) gl_FragColor = vec4(0,0,0, 3.0 / 255.0);
        //   x = edge(left(x));
        //   xx = edge(left(xx));

        //   if(shouldSplit(y)) gl_FragColor = vec4(0,0,0, 2.0 / 255.0);
        //   if(shouldSplit(yy)) gl_FragColor = vec4(0,0,0, 3.0 / 255.0);
        //   y = edge(right(y));
        //   yy = edge(right(yy));
        //   n++;
        // }
      }
    }
  `
})
export default SumReduction;