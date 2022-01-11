import utils from './utils.js';
import glsl from 'glslify';

// Sum reduction shader
const SumReduction = ({
  uniforms: {
    tDiffuse: { value: undefined },
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
    uniform float depth;
    uniform float size;
    uniform float width;
    uniform float height;
    uniform float d;
    float z = 2.0;

    ${utils}

    void main() {
      gl_FragColor = texture2D(tDiffuse, vUv);
      float index = getIndex(vUv);

      // gl_FragColor = encode(index);

      // --------------------------------------------------

      if(index >= pow(2.0, (d)) && index < pow(2.0, (d+1.0))) {
        // last row
        if(index >= pow(2.0, (depth))){
          // for bits on path to root
          float p = parent(index);
          bool split = false;
          while(p >= 1.0 && split == false){
            gl_FragColor = encode(p);
            // if bit is primary bit or split bit of node then :=1
            if(getHeap(p) > 0.0){
              if(splitBit(p, depth) == index) split = true;
              if(primaryBit(p, depth) == index) split = true;
            }
            p = parent(p);
          }
          gl_FragColor = encode(split ? 1.0 : 0.0);
          
          // gl_FragColor = encode(10.0);
        }
        // all the other rows 
        else {

          float sum = getHeap(left(index)) + getHeap(right(index));
          float current = getHeap(index);

          gl_FragColor = encode(max(sum, current));

          // gl_FragColor = encode(20.0);
        }
      }

      // --------------------------------------------------
    

      
      // if(index >= pow(2.0, (d)) && index < pow(2.0, (d+1.0))) {
      //   vec4 leftChild  = sampleCBT(left(index));
      //   vec4 rightChild = sampleCBT(right(index));

      //   vec4 leftSib  = sampleCBT(left(sibling(index)));
      //   vec4 rightSib = sampleCBT(right(sibling(index)));

      //   // vec4 leftEdge  = sampleCBT(left(edge(parent(index))));
      //   // vec4 rightEdge = sampleCBT(right(edge(parent(index))));

      //   float sum = decode(leftChild) + decode(rightChild);
      //   float sibSum = decode(leftSib) + decode(rightSib);
      //   // float edgeSum = decode(leftEdge) + decode(rightEdge);
      //   float current = decode(gl_FragColor);

      //   gl_FragColor = encode(max(sum, current));
      //   // current = decode(gl_FragColor);

      //   // tries prevents t-juctions
      //   // does not work because grand children are not guaranteed to be correct unless we split from the bottom
      //   // if(isSplit(parent(index)) == false && isSplit(edge(parent(index)))){
      //   //   gl_FragColor = encode(max(sum, 1.0));
      //   // }

      //   // prevents gaps
      //   if((sum == 0.0) && (sibSum >= 2.0)) gl_FragColor = encode(1.0);
      //   // current = decode(gl_FragColor);
        
        
      // }

      // if(index == 0.0){
      //   float k = 7.0;

      //   // float g1 = getHeap(left(left(k)));
      //   // float g2 = getHeap(right(left(k)));
      //   // float g3 = getHeap(left(right(k)));
      //   // float g4 = getHeap(right(right(k)));

      //   // // float v = g1+g2+g3+g4;
      //   // // float l = g1+g2;
      //   // // float r = g3+g4;

      //   // float l = getHeap(left(k));
      //   // float r = getHeap(right(k));

      //   // gl_FragColor = encode(r);
        
        
      //   if(isSplit(parent(k)) == false && isSplit(edge(parent(k)))){
      //     gl_FragColor = encode(100.0);
      //   } else{
      //     gl_FragColor = encode(0.0);
      //   }
      // }
    }
  `
})
export default SumReduction;