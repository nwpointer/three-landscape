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



    void main() {
      gl_FragColor = texture2D(map, vUv);
      float current = decode(gl_FragColor);
      float index = getIndex(vUv);
      float d = getDepth(index) - 1.0;

      bool split = false;

      if(shouldSplit(parent(index))) split = true; // implements self split
      if(shouldSplit(edge(parent(index)))) split = true; // implements the edge split -> 2/3
      if(shouldSplit(edge(sibling(index)))) split = true; // implements the parent split -> 4/5

      // if no edge than check up sibling path?
      // if(shouldSplit(sibling(parent(index)))) split = true; //  -> 16
      
      // if(shouldSplit(left(sibling(parent(index))))) split = true; // 4.0 cross square
      // if(shouldSplit(right(sibling(parent(index))))) split = true; // 5.0 cross square

    

      // these guys are causing the increased ring density
      // if(shouldSplit(EP(index))) split = true; // needed to cross 2/3 boundary
      // if(shouldSplit(ES(index))) split = true; // needed to cross 2/3 boundary

      // float xp = EP(index);
      // float xs = ES(index);
      // float yp = EP(index);
      // float ys = ES(index);

      // float n = 0.0;
      // while(n < depth - d){
      //   if(shouldSplit(EL(xp))) split = true;
      //   if(shouldSplit(EL(xs))) split = true;
      //   xp = EL(xp);
      //   xs = EL(xp);

      //   if(shouldSplit(ER(yp))) split = true;
      //   if(shouldSplit(ER(ys))) split = true;
      //   yp = ER(yp);
      //   ys = ER(yp);

      //   n++;
      // }

      if(split) gl_FragColor = encode(max(current, 1.0));

      
      // look for descendent that should split
      // float x = edge(index);
      // float xx = edge(left(index));
      // float y = edge(index);
      // float yy = edge(right(index));
      // float n = 0.0;
      // while(n < (depth - d)){
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

      // // maybe this works?
      // if(shouldMerge(parent(index))) gl_FragColor = vec4(0,0,0, 0.0 / 255.0);
      // if(shouldMerge(edge(parent(index)))) gl_FragColor = vec4(0,0,0, 0.0 / 255.0);
      // if(shouldMerge(edge(sibling(index)))) gl_FragColor = vec4(0,0,0, 0.0 / 255.0);

      if(index == 0.0) {
        gl_FragColor = encode(depth);
      }

    }
  `
})

export default SplitStep;