import glsl from "glslify";
import { normalFunctions, colorFunctions, glslNoise } from "../util/util";
import { aperiodic, samplers } from "../util/samplers";
import mixers from "../util/mixers";
import sort from "../util/sort";
import { ShaderMaterial } from "three";

// TODO: figure out how to use the same shader for both distant and close up
// simplified version of the shader that calculates the distant diffuse and normal maps
export function DistanceMaterial(parent) {
  return new ShaderMaterial({
    uniforms: {
      ...parent.uniforms,
      diffuseMode: { value: true },
      normalMap: { value: parent.normalMap }
    },
    vertexShader: glsl`
        precision highp float;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    fragmentShader: glsl`
        const int SURFACES = ${parent.props.surfaces.length};
        uniform int surfaceSamples;
        precision highp sampler2DArray;
        uniform bool diffuseMode;
        uniform sampler2D[2] splats;
        uniform float displacementScale;
        varying vec2 vUv;
        varying vec3 vHeightNormal;

        uniform float[SURFACES] surfaceNormalStrength;
        uniform float[SURFACES] surfaceNormalY;
        uniform float[SURFACES] surfaceRepeat;
        uniform bool[SURFACES] surfaceGridless;
        uniform bool[SURFACES] surfaceTriplanar;
        uniform vec4[SURFACES] surfaceTint;
        uniform float[SURFACES] surfaceSaturation;

        uniform sampler2DArray diffuseArray;
        uniform sampler2DArray normalArray;
        uniform sampler2D normalMap;

        ${normalFunctions}
        ${colorFunctions}
        ${glslNoise}
        float sum( vec3 v ) { return v.x+v.y+v.z; }

        ${mixers}
        ${samplers}
        ${aperiodic}
        
        void main() {
          vec4 t0 = texture2D(splats[0], vUv);
          vec4 t1 = texture2D(splats[1], vUv);
          vec2[8] surfaces = vec2[8](
            ${Array(2)
        .fill(0)
        .map((v, i) => {
          const index = i.toString();
          return glsl`
                vec2(${((i * 4 + 0) / 8.0).toString()}, t${index}.r),
                vec2(${(i * 4 + 1) / 8.0}, t${index}.g),
                vec2(${(i * 4 + 2) / 8.0}, t${index}.b),
                vec2(${(i * 4 + 3) / 8.0}, t${index}.a)`;
        })
        .join(",")}
          );
          ${sort("surfaces")}

          float[SURFACES] weights;
          float Z = 0.0; // fix this
          float weightSum = 0.0;
          for(int i = 0; i < surfaceSamples; i++) weightSum += surfaces[i].y;

          int index = int(surfaces[0].x * 8.0);
          float k = noise(vec3(vUv.xy*200.0, 0.0)); // slower but may need to do it if at texture limit

          if(diffuseMode){
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            for(int i = 0; i < surfaceSamples; i++){
              int index = int(surfaces[i].x * 8.0);
              float N = surfaceNormalY[index];
              float R = surfaceRepeat[index];
              float P = surfaceNormalStrength[index];
              bool gridless = surfaceGridless[index];
              
              weights[i] = surfaces[i].y / weightSum;
    
              // we don't bother with triplanar if the surface is distant, but we probably should
              vec4 diffuse;
              if(gridless){
                  diffuse = AperiodicLinearSample(diffuseArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
              } else {
                  diffuse = LinearSample(diffuseArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
              }
    
              diffuse = saturation(diffuse, surfaceSaturation[index]);
              diffuse = diffuse * surfaceTint[index];
              
              vec4 weightedDiffuse = diffuse * surfaces[i].y;
              gl_FragColor += weightedDiffuse;
            }
          }
          else {
            gl_FragColor = texture(normalMap, vUv);
            // gl_FragColor = zeroN;
            for(int i = 0; i < surfaceSamples; i++){
                int index = int(surfaces[i].x * 8.0);
                float N = surfaceNormalY[index];
                float R = surfaceRepeat[index];
                float P = surfaceNormalStrength[index];
                bool gridless = surfaceGridless[index];
                
                weights[i] = surfaces[i].y / weightSum;
      
                // we don't bother with triplanar if the surface is distant
                vec4 normal;
                if(gridless){
                    normal = AperiodicNormalSample(normalArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
                } else {
                    normal = NormalSample(normalArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
                }
                              
                vec4 weightedNormal = slerp(zeroN, normal, weights[i] * P);
                gl_FragColor = blend_rnm(gl_FragColor, weightedNormal);
            }
          }
        }
      `
  });
}
