import { cartesian } from "./util";
import glsl from "glslify";

export const triplanarSamplers = cartesian([["Aperiodic", ""],["Linear", "Normal"]])
  .map(([sampler, mixer]) => {
    return glsl`
    vec4 Triplanar${sampler}${mixer}Sample(sampler2DArray map, vec4 uvzi, vec3 scale, vec3 normal, float k){
      float sharpness = 30.0;
      vec3 weights = normal;
      // weights.b *= 0.9;
      weights = normalize(weights);
      weights.x = pow(weights.x, sharpness);
      weights.y = pow(weights.y, sharpness);
      weights.z = pow(weights.z, sharpness);

      // weights= vec3(1,0,0);
      
      // unsorted cheap 1 channel blend does not work well cause wavefront thrashing. 
      // if( weights.z > 86.73617){
      //   return ${sampler}${mixer}Sample(map, vec3(uvzi.xy, uvzi.a), scale.xy, k);  
      // }
        
      // expensive 3 channel blend, doing linear cause its cheaper than normal
      vec3 xDiff = ${sampler}LinearSample(map, vec3(uvzi.zy, uvzi.a), scale.zy, k).xyz;
      vec3 yDiff = ${sampler}LinearSample(map, vec3(uvzi.xz, uvzi.a), scale.xz, k).xyz;
      vec3 zDiff = ${sampler}LinearSample(map, vec3(uvzi.xy, uvzi.a), scale.xy, k).xyz;
      
      // debug
      // xDiff = vec3(1,0,0);
      // yDiff = vec3(0,1,0);
      // zDiff = vec3(0,0,1);
      
      // return vec4(0,0,0,1);
      vec3 color = ${mixer}Mix(xDiff,yDiff,zDiff, weights);
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

export const aperiodicSamplers = ["Linear", "Normal"]
  .map(
    (mixer) => glsl`
  vec4 Aperiodic${mixer}Sample(sampler2DArray map, vec3 uvi, vec2 scale, float k){
    uvi = vec3(uvi.xy * scale, uvi.z);
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
    vec2 dx = dFdx(uvi.xy), dy = dFdy(uvi.xy);
    // sample the two closest virtual patterns
    vec3 cola = textureGrad( map, vec3(uvi.xy + offa, uvi.z), dx, dy ).xyz;
    vec3 colb = textureGrad( map, vec3(uvi.xy + offb, uvi.z), dx, dy ).xyz;

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

export const basicSamplers = cartesian([["Linear", "Normal"]])
  .map(([mixer]) => {
    return glsl`
    // single channel sample does not care about mixer but having both simplifies other code
    vec4 ${mixer}Sample( sampler2DArray samp, vec3 uvi, vec2 scale, float k){
      return texture(samp, vec3(uvi.xy * scale, uvi.z));
    }
  `;
  })
  .join("\n");
