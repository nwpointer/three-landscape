const utilityFunctions = `
float sum( vec3 v ) { return v.x+v.y+v.z; }

vec4 textureNoTile( sampler2D samp, vec2 uv )
{
  // sample variation pattern
  float k = texture2D( uNoise, 0.005*uv ).x; // cheap (cache friendly) lookup

  // compute index
  float l = k*8.0;
  float f = fract(l);

  float ia = floor(l);
  float ib = ia + 1.0;

  // offsets for the different virtual patterns
  float v = 0.4;
  vec2 offa = sin(vec2(3.0,7.0)*ia); // can replace with any other hash
  vec2 offb = sin(vec2(3.0,7.0)*ib); // can replace with any other hash

  // compute derivatives for mip-mapping, requires shader extension derivatives:true
  vec2 dx = dFdx(uv), dy = dFdy(uv);

  // sample the two closest virtual patterns
  vec3 cola = textureGrad( samp, uv + v*offa, dx, dy ).xyz;
  vec3 colb = textureGrad( samp, uv + v*offb, dx, dy ).xyz;

  // // interpolate between the two virtual patterns
  vec3 col = mix( cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
  return vec4(col,1.0);
}

vec4 blend_rnm(vec4 n1, vec4 n2){
  vec3 t = n1.xyz*vec3( 2,  2, 2) + vec3(-1, -1,  0);
  vec3 u = n2.xyz*vec3(-2, -2, 2) + vec3( 1,  1, -1);
  vec3 r = t*dot(t, u) /t.z -u;
  return vec4((r), 1.0) * 0.5 + 0.5;
}

/**
* Adjusts the saturation of a color.
*
* @name czm_saturation
* @glslFunction
*
* @param {vec3} rgb The color.
* @param {float} adjustment The amount to adjust the saturation of the color.
*
* @returns {float} The color with the saturation adjusted.
*
* @example
* vec3 greyScale = czm_saturation(color, 0.0);
* vec3 doubleSaturation = czm_saturation(color, 2.0);
*/
vec4 czm_saturation(vec4 rgba, float adjustment)
{
    // Algorithm from Chapter 16 of OpenGL Shading Language
    vec3 rgb = rgba.rgb;
    const vec3 W = vec3(0.2125, 0.7154, 0.0721);
    vec3 intensity = vec3(dot(rgb, W));
    return vec4(mix(intensity, rgb, adjustment), rgba.a);
}
`
export default utilityFunctions
