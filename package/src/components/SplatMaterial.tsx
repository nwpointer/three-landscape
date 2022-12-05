import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture, sRGBEncoding } from "three";
import glsl from "glslify";
import noise from "./noise";
import { option, repeatTextures, defined, colorFunctions, glslNoise, edgeBlend, luma, normalFunctions  } from './util.js'
import { Vector4 } from 'three';

// substance instead of material?
export type Surface = {
  diffuse: Texture;
  normal?: Texture;
  repeat?: Number;
  saturation?: Number;
  tint?: Vector4
};

export default function TerrainMaterial(props: {
  wireframe?: boolean;
  surfaces: Surface[];
  map?: Texture;
  splats: Texture[];
  noise?: Texture;
  displacementMap?: Texture;
  normalMap?: Texture;
  displacementScale: Number;
}) {
  const diffuse = option(props.surfaces, 'diffuse')
  const normal = option(props.surfaces, 'normal')
  const repeat = option(props.surfaces, 'repeat', 1)
  const saturation = option(props.surfaces, 'saturation', 0.5)
  const tint = option(props.surfaces, 'tint', new Vector4(1,1,1,1))
  const gridless = option(props.surfaces, 'gridless', false)
  const blend = option(props.surfaces, 'blend', { mode: 'linear'})
  const trilinear = option(props.surfaces, 'trilinear', false)
  const textures = defined([...props.splats, ...diffuse, ...normal, noise])

  diffuse.map(t => {
    t.encoding = sRGBEncoding
    t.needsUpdate = true;
  })

  console.log(props.displacementMap);
  
  // apply repetition option to all textures
  repeatTextures(textures)

  const numSplats = props.splats.length;
  const numSplatChannels = props.splats.length * 4.0;


  const sample = (i)=>{
    let color;
    const index = i.toString();
    color = glsl`${trilinear[i] ? 'Tri':''}${gridless[i] ? 'Gridless':''}Sample(uDiffuse[${index}], vUv, uRepeat[${index}] )`
    color = glsl`saturation(${color}, uSaturation[${index}])`
    color = glsl`${color} * uTint[${index}]`
    return color
  }

  return (
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      {...props}
      map={diffuse[0]}
      uniforms={{
        uNoise: { value: props.noise || noise },
        uSplats: { value: props.splats },
        uDiffuse: { value: diffuse },
        uNormal: { value: normal },
        uRepeat: { value: repeat },
        uSaturation: { value: saturation },
        uTint: { value: tint, type:'vec4' },
      }}
      vertexShader={glsl`
        varying vec4 csm_vWorldPosition;
        varying vec3 vGeometryNormal;

        vec3 pow3(vec3 n, float x){
          return vec3(pow(n.x,x),pow(n.y,x),pow(n.z,x));
        }

        vec3 calculateNormalsFromHeightMap(){
          float o = 1.0/1024.0;
          float h = dot(texture2D(displacementMap, uv),  vec4(1,0,0,1));
          float hx = dot(texture2D(displacementMap, uv + vec2( o, 0.0 )), vec4(1,0,0,1));
          float hy = dot(texture2D(displacementMap, uv + vec2( 0.0, o )),  vec4(1,0,0,1));
          float dScale = 150.0;
          float dx = (hx - h) * dScale;
          float dy = (hy - h) * dScale;
          return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
        }
        
        void main(){
          // csm_vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          // vec3 realPosition = position;
          // realPosition.z = (texture2D( displacementMap, uv ).x * displacementScale + displacementBias);

          // realPosition /= 1024.0;
          // csm_vWorldPosition = modelMatrix * vec4((realPosition), 1.0);

          vec3 realPosition = vec3(uv.xy, 1.0) ;
          realPosition.z = (texture2D( displacementMap, uv ).x * displacementScale) / 1024.0 ;
          csm_vWorldPosition = vec4((realPosition), 1.0);

          vGeometryNormal = calculateNormalsFromHeightMap();
        }
      `}
      fragmentShader={glsl`
        varying vec4 csm_vWorldPosition;
        varying vec3 csm_vNormal;
        varying vec3 vGeometryNormal;
        vec3 csm_NormalMap;
        
        // precision highp float;
        uniform sampler2D uNoise;
        uniform sampler2D uSplats[${numSplats}];
        uniform sampler2D uDiffuse[${diffuse.length}];
        uniform sampler2D uNormal[${normal.length}];
        uniform float uRepeat[${repeat.length}];
        uniform float uSaturation[${saturation.length}];
        uniform vec4 uTint[${tint.length}];
        uniform sampler2D displacementMap;
      
        ${glslNoise}
        ${colorFunctions}
        ${edgeBlend}
        ${luma}
        ${normalFunctions}

        // TODO: proper handling of variable numbers of channels w/ forloop
        float[${numSplatChannels}] splat(){
          float splatWeights[${numSplatChannels}];
          splatWeights[0] = texture2D(uSplats[0], vUv).r;
          splatWeights[1] = texture2D(uSplats[0], vUv).g;
          splatWeights[2] = texture2D(uSplats[0], vUv).b;
          splatWeights[3] = texture2D(uSplats[0], vUv).a;
          splatWeights[4] = texture2D(uSplats[1], vUv).r;
          splatWeights[5] = texture2D(uSplats[1], vUv).g;
          splatWeights[6] = texture2D(uSplats[1], vUv).g;
          splatWeights[7] = 1.0;
          return splatWeights;
        }

        vec3 pow3(vec3 n, float x){
          return vec3(pow(n.x,x),pow(n.y,x),pow(n.z,x));
        }

        vec2 rotateUV(vec2 uv, float rotation)
        {
            float mid = 0.5;
            return vec2(
                cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
                cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
            );
        }

        float sum( vec3 v ) { return v.x+v.y+v.z; }

        // MIXERS ----------------------------------------------------------------
        
        vec3 linearMix(vec3[2] c, float weight){
          return mix( c[0], c[1], weight);
        }

        vec3 linearMix(vec3[3] c, vec3 weights){
          // color normalize (works better than normalize)
          weights /= sum(weights);
          return (c[0] * weights.x + c[1] * weights.y + c[2] * weights.z);
        }

        vec3 normalMix(vec3[2] c, float weight){
          return NormalBlend(c[0], c[1], weight);
        }

        vec3 normalMix(vec3[3] c, vec3 weights){
          vec3 colora = NormalBlend(c[2], vec3(0.5, 0.5, 1), 1.0-weights.z);
          vec3 colorb = NormalBlend(c[1], colora, 1.0-weights.y);
          vec3 colorc = NormalBlend(c[0], colorb, 1.0-weights.x);
          return colorc;
        }

        // SAMPLERS ----------------------------------------------------------------

        vec4 Sample( sampler2D samp, vec2 uv, float scale){
          return texture2D(samp, uv * scale);
        }

        vec4 GridlessSample( sampler2D samp, vec2 uv, float scale ){
          uv = uv * scale;
          // sample variation pattern
          float k = texture2D( uNoise, 0.005*uv ).x; // cheap (cache friendly) lookup
          // float k = noise(2.0*uv); // slower but may need to do it if at texture limit

        
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
          vec3 cola = texture2DGradEXT( samp, uv + v*offa, dx, dy ).xyz;
          vec3 colb = texture2DGradEXT( samp, uv + v*offb, dx, dy ).xyz;

          // interpolate between the two virtual patterns
          vec3 color = linearMix( vec3[2](cola, colb), smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
          return vec4(color,1.0);
        }


        // todo pass in a mixer:
        ${[['GridlessSample'], ['Sample']].map(([sampler])=>{
          return glsl`
          vec4 Tri${sampler}(sampler2D map, vec2 uv, float scale){
            float sharpness = 10.0;
            vec3 weights = abs(pow3(vGeometryNormal, sharpness * 2.0));

            // cheap 1 channel sample
            float cutoff = 1.5;
            if(weights.z >cutoff*weights.x && weights.z > cutoff*weights.y){
              return ${sampler}(map, csm_vWorldPosition.xy, scale);
            }

            if(weights.x >cutoff*weights.z && weights.x > cutoff*weights.y){
              return ${sampler}(map, csm_vWorldPosition.yz, scale);
            }

            if(weights.y >cutoff*weights.z && weights.y > cutoff*weights.x){
              return ${sampler}(map, csm_vWorldPosition.xz, scale);
            }
            
            // expensive 3 channel blend
            vec3 xDiff = ${sampler}(map, csm_vWorldPosition.yz, scale).xyz;
            vec3 yDiff = ${sampler}(map, csm_vWorldPosition.xz, scale).xyz;
            vec3 zDiff = ${sampler}(map, csm_vWorldPosition.xy, scale).xyz;

            vec3 color = linearMix(vec3[3](xDiff,yDiff,zDiff), weights);
            return vec4(color,1.0);
            
          }
          `
        }).join("\n")}

        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float splatWeights[${numSplatChannels}] = splat();
          
          csm_DiffuseColor = ${props.surfaces.map((surface, i)=>{
            const index = i.toString();
            if(blend[i].mode === 'noise'){
              return blend[i].octaves.map((octaves) => {
                const octavesParams = Object.values(octaves).map((v:Number)=>v.toFixed(8)).join(',')
                return glsl`(${sample(i)} * edgeBlend(splatWeights[${index}], ${octavesParams}))`
              })
              .join("+")
            }
            if(blend[i].mode === 'linear') return glsl`${sample(i)} * splatWeights[${index}]`
            else return glsl`${sample(i)} * splatWeights[${index}]`
          }).join("+")};

          csm_DiffuseColor = normalize(csm_DiffuseColor);
          
          ${props.normalMap && `
          csm_NormalMap = texture2D(normalMap, vUv).xyz;
          `}
        }
      `}
      patchMap={{
        csm_NormalMap: props.normalMap ? {
          "#include <normal_fragment_maps>": glsl`
            vec3 mapN = csm_NormalMap;
            mapN.xy *= normalScale;
            normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
          `,
        } : {},
      }}
    />
  );
}