import { cartesian } from "./util";
import glsl from "glslify";

export const triplanar = cartesian([["Aperiodic", ""],["Linear", "Normal"]])
  .map(([sampler, mixer]) => {
    return glsl`
    vec4 Triplanar${sampler}${mixer}Sample(sampler2DArray map, vec4 uv, vec2 scale, float k){
      float sharpness = 30.0;
      vec3 weights;
      // vec3 normal = (texture(normalMap, vUv)).xyz * vec3(1.5,1,1);
      // vec3 normal = heightNormal * vec3(1,1,0.05);
      // this should increase with smoothness
      vec3 normal = vHeightNormal * vec3(1,1,1);
      weights.x = pow(normal.x, sharpness);
      weights.y = pow(normal.y, sharpness);
      weights.z = pow(normal.z, sharpness);

      // normalize(weights);

      float sZ = displacementScale/1024.0;

      // unsorted cheap 1 channel blend does not work well cause wavefront thrashing. 
      // if( weights.z > 86.73617){
      //   return ${sampler}${mixer}Sample(map, vec3(uv.xy, uv.a), vec2(scale.x, scale.y));  
      // }
      
      // expensive 3 channel blend, doing linear cause its cheaper than normal
      vec3 xDiff = ${sampler}LinearSample(map, vec3(uv.zy, uv.a), vec2(scale.x * sZ, scale.y ), k).xyz;
      vec3 yDiff = ${sampler}LinearSample(map, vec3(uv.xz, uv.a), vec2(scale.x, scale.x * sZ), k).xyz;
      vec3 zDiff = ${sampler}LinearSample(map, vec3(uv.xy, uv.a), vec2(scale.x, scale.y), k).xyz;

      // debug
      // xDiff = vec3(1,0,0);
      // yDiff = vec3(0,1,0);
      // zDiff = vec3(0,0,1);

      vec3 color = ${mixer}Mix(xDiff,yDiff,zDiff, weights);
      // color = ${mixer}Mix(zDiff,zDiff,zDiff, weights);
      return vec4(color,1.0);
    }
    `;
  })
  .join("\n");

  // there are blending artifacts when using this, but it is faster
  export const biplanar = cartesian([["Aperiodic", ""],["Linear", "Normal"]])
  .map(([sampler, mixer]) => {
    return glsl`
    vec4 Biplanar${sampler}${mixer}Sample(sampler2DArray sam, vec4 p, vec2 scale, float k){
      vec4 uv = p;
      // vec2 dx = dFdx(uv.xy), dy = dFdy(uv.xy);
      vec3 n = abs(vHeightNormal.xyz);

      ivec3 ma = (n.x>n.y && n.x>n.z) ? ivec3(0,1,2):
                 (n.y>n.z)            ? ivec3(1,2,0):
                                        ivec3(2,0,1);
      ivec3 mi = (n.x<n.y && n.x<n.z) ? ivec3(0,1,2):
                 (n.y<n.z)            ? ivec3(1,2,0):
                                        ivec3(2,0,1);
      ivec3 me = ivec3(3) - mi - ma;

      float sZ = (displacementScale)/1024.0;
      vec3 s = vec3(
        scale.x,
        scale.y, 
        scale.x * sZ
      );
      
      // project+fetch
      vec4 x =  ${sampler}${mixer}Sample( sam, vec3(uv[ma.y],uv[ma.z], uv.w), vec2(s[ma.y],s[ma.z]), k);
      vec4 y =  ${sampler}${mixer}Sample( sam, vec3(uv[me.y],uv[me.z], uv.w), vec2(s[me.y],s[me.z]), k);

      // vec4 x =  c[ma.y];
      // vec4 y =  c[me.y];

      // blend
      vec2 w = vec2(n[ma.x],n[me.x]);
      w = clamp( (w-0.5773)/(1.0-0.5773), 0.0, 1.0 );
      w = pow( w, vec2(8.0/8.0) );
      float sum = w.x + w.y;
      
      vec3 color = ${mixer}Mix(x.xyz,y.xyz, w.x / sum);
      return vec4(color,1.0);
      // return (x*w.x + y*w.y) / (w.x + w.y);

      // return vec4(1);
    }
    `;
  })
  .join("\n");

export const aperiodic = ["Linear", "Normal"]
  .map(
    (mixer) => glsl`
  vec4 Aperiodic${mixer}Sample(sampler2DArray map, vec3 uv, vec2 scale, float k){
    uv = vec3(uv.xy * scale, uv.z);
    // sample variation pattern
    // float k = texture( uNoise, 0.005*uv.xy ).x; // cheap (cache friendly) lookup
    // float k2 = noise(uv * 1.0); // slower but may need to do it if at texture limit

    // compute index
    float l = k * 8.0;
    float f = fract(l);
    float ia = floor(l);
    float ib = ia + 1.0;

    // offsets for the different virtual patterns
    vec2 offa = sin(vec2(3.0,7.0)*ia); // can repdlace with any other hash
    vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

    

    // compute derivatives for mip-mapping, requires shader extension derivatives:true
    vec2 dx = dFdx(uv.xy), dy = dFdy(uv.xy);
    // sample the two closest virtual patterns
    vec3 cola = textureGrad( map, vec3(uv.xy + offa, uv.z), dx, dy ).xyz;
    vec3 colb = textureGrad( map, vec3(uv.xy + offb, uv.z), dx, dy ).xyz;

    // vec4 a = texture(map, vec3(uv.xy, uv.z));
    // vec4 b = texture(map, vec3(uv.xy+vec2(0.5, 0.5), uv.z));
    // return a;

    // debug
    // cola = vec3(1,0,0);
    // colb = vec3(0,1,0);

    // interpolate between the two virtual patterns
    vec3 color = ${mixer}Mix(cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
    return vec4(color,1.0);
  }
`
  )
  .join("\n");

export const samplers = cartesian([["Linear", "Normal"]])
  .map(([mixer]) => {
    return glsl`
    // single channel sample does not care about mixer but having both simplifies other code
    vec4 ${mixer}Sample( sampler2DArray samp, vec3 uv, vec2 scale, float k){
      return texture(samp, vec3(uv.xy * scale, uv.z));
    }
  `;
  })
  .join("\n");
