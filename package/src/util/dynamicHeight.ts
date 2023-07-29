import glsl from "glslify";
import catmullRom from "./catmullRom";


export const dynamicHeightUtils = glsl`

  ${catmullRom}
  
  float getSmoothHeight(vec2 uv, vec2 displacementMapSize){
    vec2 heightUv = uv;
    vec2 tHeightSize = displacementMapSize;
    // make smoothness a surface property
    tHeightSize /= smoothness;
    vec2 texel = vec2( 1.0 / tHeightSize );
    vec2 heightUv00 = ( floor( heightUv * tHeightSize ) ) / tHeightSize;
    vec2 frac = vec2( heightUv - heightUv00 ) * tHeightSize;

    float h = textureBicubic( displacementMap, heightUv00, texel, frac );
    return abs(h);
    // return 5.0;
  }

  vec3 calculateNormalsFromSmoothedHeightMap(sampler2D displacementMap, vec2 displacementMapSize,  vec2 uv){
    float h = getSmoothHeight(uv, displacementMapSize);
    float hx = getSmoothHeight(uv + vec2( 1.0/1024.0, 0.0 ), displacementMapSize);
    float hy = getSmoothHeight(uv + vec2( 0.0, 1.0/1024.0 ), displacementMapSize);
    float dx = ((hx - h) * 120.0);
    float dy = ((hy - h) * 120.0);
    // return vec3(120.0,0,0);
    return abs(cross(normalize(vec3(1.0,0.0,dx)), normalize(vec3(0.0,1.0,dy))));
  }

  vec3 calculateNormalsFromHeightMap(sampler2D displacementMap, vec2 uv){
    vec2 guv = uv - mod(uv, 1.0/1024.0);
    float stepSize = 1.0;
    float h = dot(texture(displacementMap, guv),  vec4(1,0,0,1));
    float hx = dot(texture(displacementMap, guv + vec2( stepSize/1024.0, 0.0 )), vec4(1,0,0,1));
    float hy = dot(texture(displacementMap, guv + vec2( 0.0, stepSize/1024.0 )),  vec4(1,0,0,1));
    // todo: use dFXdy and dFXdx instead of 3 samples if run in fragment shader
    float dx = (hx - h) * 120.0;
    float dy = (hy - h) * 120.0;
    return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
  }
`