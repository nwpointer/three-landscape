import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture, sRGBEncoding } from "three";
import glsl from "glslify";
import noise from "./noise";
import { option, repeatTextures, defined, colorFunctions, glslNoise, edgeBlend  } from './util.js'
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
  const textures = defined([...props.splats, ...diffuse, ...normal, noise])

  diffuse.map(t => {
    t.encoding = sRGBEncoding
    t.needsUpdate = true;
  })
  
  // apply repetition option to all textures
  repeatTextures(textures)

  const numSplats = props.splats.length;
  const numSplatChannels = props.splats.length * 4.0;

  const sample = (i)=>{
    let color;
    if(gridless[i]){
      color =  `gridlessSample(uDiffuse[${i}], vUv * uRepeat[${i}])`  
      // color =  `texture2D(uDiffuse[${i}], vUv * uRepeat[${i}])`  
    } else {
      // color =  `texture2D(uDiffuse[${i}], vUv * uRepeat[${i}])`
      color =  `triSample(uDiffuse[${i}], uRepeat[${i}])`
    }
    color = `saturation(${color}, uSaturation[${i}])`
    color = `${color} * uTint[${i}]`
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
        varying vec3 vN2;

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

          // realPosition /= 1024.0;
          csm_vWorldPosition = vec4((realPosition), 1.0);

          vN2 = calculateNormalsFromHeightMap();
          
          // csm_vWorldPosition.x / 1024.0;
          // csm_vWorldPosition.y / 1024.0;
          // csm_vWorldPosition.z / 1024.0;
        }
      `}
      fragmentShader={glsl`
        varying vec4 csm_vWorldPosition;
        varying vec3 csm_vNormal;
        varying vec3 vN2;
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

        vec2 rotateUV(vec2 uv, float rotation)
        {
            float mid = 0.5;
            return vec2(
                cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
                cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
            );
        }

        float sum( vec3 v ) { return v.x+v.y+v.z; }
        vec4 gridlessSample( sampler2D samp, vec2 uv ){
          // sample variation pattern
          float k = texture2D( uNoise, 0.005*uv ).x; // cheap (cache friendly) lookup
          // float k = noise(2.0*uv);

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

          // vec3 cola = vec3(1.0,0.0, 0.0);
          // vec3 colb = vec3(0.0,1.0, 0.0);

          // // interpolate between the two virtual patterns
          vec3 col = mix( cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
          return vec4(col,1.0);
        }

        vec3 pow3(vec3 n, float x){
          return vec3(pow(n.x,x),pow(n.y,x),pow(n.z,x));
        }

        vec3 calculateNormalsFromHeightMap(){
          float o = 1.0/1024.0;
          float h = dot(texture2D(displacementMap, vUv),  vec4(1,0,0,1));
          float hx = dot(texture2D(displacementMap, vUv + vec2( o, 0.0 )), vec4(1,0,0,1));
          float hy = dot(texture2D(displacementMap, vUv + vec2( 0.0, o )),  vec4(1,0,0,1));
          float dScale = 150.0;
          float dx = (hx - h) * dScale;
          float dy = (hy - h) * dScale;
          return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
        }

        vec3 n2;
        vec3 n1;
    
        vec4 triSample(sampler2D map, float scale){
          // vec3 n = texture2D( normalMap, vUv ).xyz;
          vec3 n = (n1);
          float sharpness = 4.0;
          vec3 weightsNormal = normalize(pow3(n,1.0)) /1.20;
          vec3 weightsGeo = normalize(pow3(vN2,1.0));

          vec3 weights = normalize(vec3(
            min(weightsGeo.r, weightsNormal.r),
            max(weightsGeo.g, weightsNormal.g),
            min(weightsGeo.b, weightsNormal.b)
          ));

          // todo: consider taking abs value - thats why min max is weird

          weights = normalize(pow3(weights, sharpness));

          // if(weightsGeo.g > 3.0*weightsGeo.r && weightsGeo.g > 3.0*weightsGeo.b){
          //   return vec4(1.0,1.0,1.0, 1.0);
          // }
          
			    // vec3 xDiff = texture2D(map, (csm_vWorldPosition.yz * scale)).xyz;
          // vec3 yDiff = texture2D(map, (csm_vWorldPosition.xz * scale)).xyz;
          // vec3 zDiff = texture2D(map, (csm_vWorldPosition.xy * scale)).xyz;

          vec3 b = vec3(0.0,0.0,1.0);
          vec3 r = vec3(1.0,0.0,0.0);
          vec3 g = vec3(0.0,1.0,0.0);

          vec3 color = (b * weights.x + r * weights.y + g * weights.z);
          if(color.g > 0.5*color.r && color.g > 0.0*color.b){
            return gridlessSample(map, (csm_vWorldPosition.xy * scale));
          }
          if(color.b > 0.5*color.r && color.b > 0.0*color.g){
            return gridlessSample(map, (csm_vWorldPosition.yz * scale));
          }
          if(color.r > 0.5*color.g && color.r > 0.0*color.b){
            return gridlessSample(map, (csm_vWorldPosition.xz * scale));
          }
          
          // soft
          vec3 xDiff = gridlessSample(map, (csm_vWorldPosition.yz * scale)).xyz;
          vec3 yDiff = texture2D(map, (csm_vWorldPosition.xz * scale)).xyz;
          vec3 zDiff = texture2D(map, (csm_vWorldPosition.xy * scale)).xyz;
          color = (xDiff * weights.x + yDiff * weights.y + zDiff * weights.z);

          return vec4(color,1.0);
          
          // hard light trisample: 
          // if(weights.x > weights.y && weights.x > weights.z){
          //   return texture2D(map, (csm_vWorldPosition.yz * scale));
          // }
          // if(weights.y > weights.x && weights.y > weights.z){
          //   return texture2D(map, (csm_vWorldPosition.xz * scale));
          // }
          // return texture2D(map, (csm_vWorldPosition.xy * scale));

          if(weights.z > weights.x && weights.y > weights.x){
            vec3 zDiff = vec3(0.0,1.0,0.0);
          }

          // if(weights.x > weights.y && weights.x > weights.z){
          //   // return texture2D(map, (csm_vWorldPosition.yz * scale));
          //   return vec4(0.0,0.0,1.0, 1.0);
          // }
          // if(weights.y > weights.x && weights.y > weights.z){
          //   // return texture2D(map, (csm_vWorldPosition.xz * scale));
          //   return vec4(1.0,0.0,0.0, 1.0);
          // }
          // // return texture2D(map, (csm_vWorldPosition.xy * scale));
          // return vec4(0.0,1.0,0.0, 1.0);
          
        }

        




        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float splatWeights[${numSplatChannels}] = splat();

          n2 = calculateNormalsFromHeightMap();
          // n2 = vec3(1.0,1.0,1.0);
          n1 = texture2D( normalMap, vUv ).xyz;

          // ${props.displacementMap && `
          //   displacement code
          // `}

          // grid break f(uv)
          // paralax f(uv)
          // edge blending - edge(splatWeights[0], 1.0)
          // height blending

          // DONE:
          // brightness + saturation f(sample)

          // float amplitude = 1.5;
          // float wavelength = 1024.0*4.0;
          // float accuracy  = 1.5;

          csm_DiffuseColor = ${props.surfaces.map((surface, i)=>{
            if(blend[i].mode === 'noise'){
              return blend[i].octaves.map((octaves) => {
                const octavesParams = Object.values(octaves).map((v:Number)=>v.toFixed(8)).join(',')
                return `(${sample(i)} * edgeBlend(splatWeights[${i}], ${octavesParams}))`
              })
              .join("+")
            }
            if(blend[i].mode === 'linear') return `${sample(i)} * splatWeights[${i}]`
            else return `${sample(i)} * splatWeights[${i}]`
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

/*

            if(blend[i].mode === 'noise'){
              return blend[i].octaves.map((octaves) => {
                const octavesParams = Object.values(octaves).map((v:Number)=>v.toFixed(2)).join(',')
                return `(${sample(i)} * edgeBlend(splatWeights[${i}], ${octavesParams}))`
              })
              .join("+")
            }
*/