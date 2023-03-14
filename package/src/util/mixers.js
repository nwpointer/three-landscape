import glsl from "glslify";

export default glsl`
  float sum( vec3 v ) { return v.x+v.y+v.z; }
  
  vec3 LinearMix(vec3 c0, vec3 c1, float weight){
    return mix(c0, c1, weight);
  }
  vec3 LinearMix(vec3 c0, vec3 c1, vec3 c2, vec3 weights){
    // color normalize (works better than normalize)
    weights /= sum(weights);
    return (c0 * weights.x + c1 * weights.y + c2 * weights.z);
  }

  vec3 NormalMix(vec3 c0, vec3 c1, float weight){
    return blend_rnm(
      slerp(zeroN, vec4(c0, 1.0), 1.0 - weight),
      slerp(zeroN, vec4(c1, 1.0), weight)
    ).xyz;
  }

  vec3 NormalMix(vec3 c0, vec3 c1, vec3 c2, vec3 weights){
    weights /= sum(weights);
    vec4 colora = slerp(zeroN, vec4(c0, 1.0), weights.x);
    vec4 colorb = slerp(zeroN, vec4(c1, 1.0), weights.y);
    vec4 colorc = slerp(zeroN, vec4(c2, 1.0), weights.z);
    vec4 colord = blend_rnm(colorc, colorb);
    vec4 colore = blend_rnm(colora, colord);
    return colore.xyz;
  }
`