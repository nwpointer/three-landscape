import glsl from "glslify";

export default glsl`
  // catmull works by specifying 4 control points p0, p1, p2, p3 and a weight. The function is used to calculate a point n between p1 and p2 based
  // on the weight. The weight is normalized, so if it's a value of 0 then the return value will be p1 and if its 1 it will return p2. 
  float catmullRom( float p0, float p1, float p2, float p3, float weight ) {
    float weight2 = weight * weight;
    return 0.5 * (
        p0 * weight * ( ( 2.0 - weight ) * weight - 1.0 ) +
        p1 * ( weight2 * ( 3.0 * weight - 5.0 ) + 2.0 ) +
        p2 * weight * ( ( 4.0 - 3.0 * weight ) * weight + 1.0 ) +
        p3 * ( weight - 1.0 ) * weight2 );
  }

  vec4 catmullRomAll( vec4 p0, vec4 p1, vec4 p2, vec4 p3, float weight ) {
    float weight2 = weight * weight;
    return 0.5 * (
        p0 * weight * ( ( 2.0 - weight ) * weight - 1.0 ) +
        p1 * ( weight2 * ( 3.0 * weight - 5.0 ) + 2.0 ) +
        p2 * weight * ( ( 4.0 - 3.0 * weight ) * weight + 1.0 ) +
        p3 * ( weight - 1.0 ) * weight2 );
  }

  // Performs a horizontal catmulrom operation at a given V value.
  float textureCubicU( sampler2D samp, vec2 uv00, float texel, float offsetV, float frac ) {
    return catmullRom(
        textureLod( samp, uv00 + vec2( -texel, offsetV ), 0.0 ).r,
        textureLod( samp, uv00 + vec2( 0.0, offsetV ), 0.0 ).r,
        textureLod( samp, uv00 + vec2( texel, offsetV ), 0.0 ).r,
        textureLod( samp, uv00 + vec2( texel * 2.0, offsetV ), 0.0 ).r,
    frac );
  }

  vec4 textureCubicUAll( sampler2D samp, vec2 uv00, float texel, float offsetV, float frac ) {
    return catmullRomAll(
        textureLod( samp, uv00 + vec2( -texel, offsetV ), 0.0 ),
        textureLod( samp, uv00 + vec2( 0.0, offsetV ), 0.0 ),
        textureLod( samp, uv00 + vec2( texel, offsetV ), 0.0 ),
        textureLod( samp, uv00 + vec2( texel * 2.0, offsetV ), 0.0 ),
    frac );
  }

  // Samples a texture using a bicubic sampling algorithm. This essentially queries neighbouring
  // pixels to get an average value.
  float textureBicubic( sampler2D samp, vec2 uv00, vec2 texel, vec2 frac ) {
    return catmullRom(
        textureCubicU( samp, uv00, texel.x, -texel.y, frac.x ),
        textureCubicU( samp, uv00, texel.x, 0.0, frac.x ),
        textureCubicU( samp, uv00, texel.x, texel.y, frac.x ),
        textureCubicU( samp, uv00, texel.x, texel.y * 2.0, frac.x ),
    frac.y );
  }

  vec4 textureBicubicAll( sampler2D samp, vec2 uv00, vec2 texel, vec2 frac ) {
    return catmullRomAll(
        textureCubicUAll( samp, uv00, texel.x, -texel.y, frac.x ),
        textureCubicUAll( samp, uv00, texel.x, 0.0, frac.x ),
        textureCubicUAll( samp, uv00, texel.x, texel.y, frac.x ),
        textureCubicUAll( samp, uv00, texel.x, texel.y * 2.0, frac.x ),
    frac.y );
  }
`