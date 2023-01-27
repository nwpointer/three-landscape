import { cartesian } from "./util";
import glsl from "glslify";

export const triplanar = cartesian([["Aperiodic", ""],["Linear", "Normal"]])
  .map(([sampler, mixer]) => {
    return glsl`
    vec4 Triplanar${sampler}${mixer}Sample(sampler2DArray map, vec4 uv, vec2 scale){
      float sharpness = 8.0;
      vec3 weights;
      // vec3 normal = (texture(normalMap, vUv)).xyz * vec3(1.5,1,1);
      // vec3 normal = heightNormal * vec3(1,1,0.05);
      // this should increase with smoothness
      vec3 normal = vHeightNormal * vec3(1,1,1.25);
      weights.x = pow(normal.x, sharpness);
      weights.y = pow(normal.y, sharpness);
      weights.z = pow(normal.z, sharpness);

      // normalize(weights);

      float sZ = displacementScale/1024.0;
      
      // expensive 3 channel blend
      vec3 xDiff = ${sampler}${mixer}Sample(map, vec3(uv.zy, uv.a), vec2(scale.x * sZ, scale.y )).xyz;
      vec3 yDiff = ${sampler}${mixer}Sample(map, vec3(uv.xz, uv.a), vec2(scale.x, scale.x * sZ)).xyz;
      vec3 zDiff = ${sampler}${mixer}Sample(map, vec3(uv.xy, uv.a), vec2(scale.x, scale.y)).xyz;

      // debug
      xDiff = vec3(1,0,0);
      yDiff = vec3(0,1,0);
      zDiff = vec3(0,0,1);

      vec3 color = ${mixer}Mix(xDiff,yDiff,zDiff, weights);
      // color = ${mixer}Mix(zDiff,zDiff,zDiff, weights);
      return vec4(color,1.0);
    }
    `;
  })
  .join("\n");

export const aperiodic = ["Linear", "Normal"]
  .map(
    (mixer) => glsl`
  vec4 Aperiodic${mixer}Sample(sampler2DArray map, vec3 uv, vec2 scale ){
    uv = vec3(uv.xy * scale, uv.z);
    // sample variation pattern
    // float k = texture( uNoise, 0.005*uv.xy ).x; // cheap (cache friendly) lookup
    float k = noise(uv * 1.0); // slower but may need to do it if at texture limit

    // compute index
    float l = k * 8.0;
    float f = fract(l);
    float ia = floor(l);
    float ib = ia + 1.0;

    // offsets for the different virtual patterns
    vec2 offa = sin(vec2(3.0,7.0)*ia); // can replace with any other hash
    vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

    // compute derivatives for mip-mapping, requires shader extension derivatives:true
    vec2 dx = dFdx(uv.xy), dy = dFdy(uv.xy);
    // sample the two closest virtual patterns
    vec3 cola = textureGrad( map, vec3(uv.xy + offa, uv.z), dx, dy ).xyz;
    vec3 colb = textureGrad( map, vec3(uv.xy + offb, uv.z), dx, dy ).xyz;

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
    vec4 ${mixer}Sample( sampler2DArray samp, vec3 uv, vec2 scale){
      return texture(samp, vec3(uv.xy * scale, uv.z));
    }
  `;
  })
  .join("\n");
