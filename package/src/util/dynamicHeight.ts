import glsl from "glslify";
import catmullRom from "./catmullRom";


export const dynamicHeightUtils = glsl`

  ${catmullRom}
  
  float getSmoothHeight(vec2 uv){
    vec2 heightUv = uv;
    vec2 tHeightSize = displacementSize;
    // make smoothness a surface property
    tHeightSize /= smoothness;
    vec2 texel = vec2( 1.0 / tHeightSize );
    vec2 heightUv00 = ( floor( heightUv * tHeightSize ) ) / tHeightSize;
    vec2 frac = vec2( heightUv - heightUv00 ) * tHeightSize;

    float h = textureBicubic( displacementMap, heightUv00, texel, frac );
    return h;
  }

  vec3 calculateNormalsFromSmoothedHeightMap(sampler2D displacementMap, vec2 uv){
    float h = getSmoothHeight(uv);
    float hx = getSmoothHeight(uv + vec2( 1.0/displacementSize.x, 0.0 ));
    float hy = getSmoothHeight(uv + vec2( 0.0, 1.0/displacementSize.y ));
    float dx = (hx - h) * displacementScale;
    float dy = (hy - h) * displacementScale;
    return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
  }

  vec3 calculateNormalsFromHeightMap(sampler2D displacementMap, vec2 uv){
    vec2 guv = uv - mod(uv, 1.0/displacementSize.y);
    float h = dot(texture(displacementMap, guv),  vec4(1,0,0,1));
    float hx = dot(texture(displacementMap, guv + vec2( 1.0/displacementSize.x, 0.0 )), vec4(1,0,0,1));
    float hy = dot(texture(displacementMap, guv + vec2( 0.0, 1.0/displacementSize.y )),  vec4(1,0,0,1));
    // todo: use dFXdy and dFXdx instead of 3 samples if run in fragment shader
    float dx = (hx - h) * displacementScale;
    float dy = (hy - h) * displacementScale;
    return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
  }
`