import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture, sRGBEncoding } from "three";
import glsl from "glslify";
import noise from "./noise";
import { option, repeatTextures, srgbTextures, defined, colorFunctions, glslNoise, edgeBlend, luma, normalFunctions  } from './util.js'
import { Vector4 } from 'three';
import TextureMerger from '../textureMerger'
import { useThree, MeshStandardMaterialProps } from "@react-three/fiber";

// substance instead of material?
export type Surface = {
  diffuse: Texture;
  normal?: Texture;
  normalStrength?: Number;
  repeat?: Number;
  saturation?: Number;
  tint?: Vector4
  splatId?: Number;
};

export default function TerrainMaterial(props: MeshStandardMaterialProps & {
  surfaces: Surface[];
  map?: Texture;
  splats: Texture[];
  noise?: Texture;
  displacementMap?: Texture;
  normalMap?: Texture;
  normalScale?: [Number, Number];
  anisotropy: Number | 'max';
  displacementScale: Number;
}) {
  const {gl} = useThree();
  const diffuse = option(props.surfaces, 'diffuse')
  const normal = option(props.surfaces, 'normal')
  const repeat = option(props.surfaces, 'repeat', 1)
  const saturation = option(props.surfaces, 'saturation', 0.5)
  const tint = option(props.surfaces, 'tint', new Vector4(1,1,1,1))
  const gridless = option(props.surfaces, 'gridless', false)
  const blend = option(props.surfaces, 'blend', { mode: 'linear'})
  const triplanar = option(props.surfaces, 'triplanar', false)
  const surfaceTextures = [...diffuse, ...normal];
  const textures = defined([...props.splats, ...surfaceTextures, noise])
  const createAtlas = false;

  diffuse.map(t => {
    t.encoding = sRGBEncoding
    t.needsUpdate = true;
  })

  // check for duplicate textures by texture uuid
  const ti = surfaceTextures.map(t=>t.uuid).filter(onlyUnique)
  const tx = removeDuplicated(surfaceTextures);
  const textureMap = []
  props.surfaces.forEach((surface, s) => {
    textureMap[s] = {}
    textureMap[s].splatId = typeof surface.splatId != 'undefined' ? surface.splatId : s;
    for(const textureType of ['normal', 'diffuse']){
      textureMap[s][textureType] = {
        id: surface[textureType] ? ti.indexOf(surface[textureType].uuid) : -1
      }
    }
  })

  let anisotropy = props.anisotropy === 'max' ? gl.capabilities.getMaxAnisotropy() : props.anisotropy || 1
  tx.map(t => {
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
  })


  // TODO: only create atlas if nessisary?
  if(createAtlas){
    var textureMerger = new TextureMerger( toObject(tx), gl.capabilities.maxTextureSize);
    var atlas = [textureMerger.mergedTexture];
    // startU, endU, startV, endV
    var ranges = Object.values(textureMerger.ranges).map(range => Object.values(range))
  }
  
  // const nids = (props.surfaces.map(surface => tid.indexOf())
  // apply repetition option to all textures
  repeatTextures(textures)
  srgbTextures([props.displacementMap, ...surfaceTextures, props.normalMap])

  const numSplats = props.splats.length;
  const numSplatChannels = props.splats.length * 4.0;
  const numSufaces = props.surfaces.length
  const displacementWidth = props.displacementMap.image.width;
  
  

  // TODO: modify sampler to use the generated atlas

  const sample = (i, mixer="Linear", map="diffuse")=>{
    let color;
    const index = i.toString();
    const textureIndex = textureMap[i][map].id.toString();
    if(createAtlas){
      var map = `uAtlas[0]` // todo support multiple atlas
      const [startU, endU, startV, endV] = ranges[textureIndex].map(v=>v.toFixed(8));
      const coordX = `(vUv.x * (${endU} - ${startU}) + ${startU})`;
      const coordY = `(vUv.y * (${startV} - ${endV}) + ${endV})`;
      var uv = `vec2(${coordX}, ${coordY})`
    } else {
      var map = `uTextures[${textureIndex}]`
      var uv = `vUv`
    }
    // todo handle index -1?
    color = glsl`${triplanar[i] ? 'Tri':''}${gridless[i] ? 'Gridless':''}Sample${mixer}(${map}, ${uv}, uRepeat[${index}] )`
    color = glsl`saturation(${color}, uSaturation[${index}])`
    color = glsl`${color} * uTint[${index}]`
    return color
  }

  return (
    
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
        // @ts-expect-error
        uTint: { value: tint, type:'vec4' },
        uAtlas: { value: atlas}, 
        // uNormalID: {value: textureMap.map(t=>t.normal.id)},
        // uDiffuseID: {value: textureMap.map(t=>t.diffuse.id)},
        uTextures: {value: tx }
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
        uniform float uRepeat[${repeat.length}];
        uniform float uSaturation[${saturation.length}];
        uniform vec4 uTint[${tint.length}];
        
        
        // texture indexes
        // uniform sampler2D uDiffuse[${diffuse.length}];
        // uniform sampler2D uNormal[${normal.length}];

        uniform sampler2D uNoise;
        uniform sampler2D uSplats[${numSplats}];
        uniform sampler2D displacementMap;
        // uniform sampler2D normalMap; // is allready defined
        uniform sampler2D uTextures[${tx.length}];
        uniform sampler2D uAtlas[1];
        
        // will probably be able to inline this info, so no need for vars?:
        // uniform int uNormalID[${numSufaces}];
        // uniform int uDiffuseID[${numSufaces}];
        uniform vec2 uTextureOffset[${numSufaces}];
        uniform vec2 uTextureSize[${numSufaces}];

      
        ${glslNoise}
        ${colorFunctions}
        ${edgeBlend}
        ${luma}
        ${normalFunctions}

        vec3 n2;

        // TODO: proper handling of variable numbers of channels w/ forloop
        float[${numSplatChannels}] splat(){
          float splatWeights[${numSplatChannels}];
          vec4 t0 = texture2D(uSplats[0], vUv);
          vec4 t1 = texture2D(uSplats[1], vUv);
          splatWeights[0] = t0.r;
          splatWeights[1] = t0.g;
          splatWeights[2] = t0.b;
          splatWeights[3] = t0.a;
          splatWeights[4] = t1.r;
          splatWeights[5] = t1.g;
          splatWeights[6] = t1.b;
          splatWeights[7] = t1.a;
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
        
        vec3 LinearMix(vec3 c0, vec3 c1, float weight){
          return mix(c0, c1, weight);
        }

        vec3 LinearMix(vec3 c0, vec3 c1, vec3 c2, vec3 weights){
          // color normalize (works better than normalize)
          weights /= sum(weights);
          // c0.r = 1.0;
          // c1.b = 1.0;
          // c2.g = 1.0;
          return (c0 * weights.x + c1 * weights.y + c2 * weights.z);
        }

        vec3 NormalMix(vec3 c0, vec3 c1, float weight){
          return blend_rnm(
            slerp(zeroN, vec4(c0, 1.0), 1.0 - weight),
            // vec4(c0, 1.0),
            slerp(zeroN, vec4(c1, 1.0), weight) // mix also works but is slightly wrong
          ).xyz;
        }

        vec3 NormalMix(vec3 c0, vec3 c1, vec3 c2, vec3 weights){
          weights /= sum(weights);
          
          // mixing all three just looks messy most of the time
          // vec3 colora = slerp(zeroN, vec4(c0, 1.0), weights.z).xyz;
          // vec3 colorb = NormalMix(c1, colora, 1.0-weights.y);
          // vec3 colorc = NormalMix(c2, colorb, 1.0-weights.x);
          vec4 colora = slerp(zeroN, vec4(c0, 1.0), weights.x);
          vec4 colorb = slerp(zeroN, vec4(c1, 1.0), weights.y);
          vec4 colorc = slerp(zeroN, vec4(c2, 1.0), weights.z);
          vec4 colord = blend_rnm(colorc, colorb);
          vec4 colore = blend_rnm(colora, colord);
          return colore.xyz;
          // return colord.xyz;
        }

        // SAMPLERS ----------------------------------------------------------------

        ${cartesian([['Linear', 'Normal']]).map(([mixer])=>{
          return glsl`
            // single channel sample does not care about mixer but having both simplifies other code
            vec4 Sample${mixer}( sampler2D samp, vec2 uv, float scale){
              return texture2D(samp, uv * scale);
            }
          `;
        }).join("\n")}

        ${cartesian([['Linear', 'Normal']]).map(([mixer])=>{
          return glsl`
            vec4 GridlessSample${mixer}( sampler2D samp, vec2 uv, float scale ){
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
              vec3 color = ${mixer}Mix(cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
              return vec4(color,1.0);
            }
          `;
        }).join("\n")}

        ${cartesian([['GridlessSample', 'Sample'], ['Linear', 'Normal']]).map(([sampler, mixer])=>{
          return glsl`
          vec4 Tri${sampler}${mixer}(sampler2D map, vec2 uv, float scale){
            float sharpness = 8.0;
            vec3 weights = n2;
            weights.x = pow(n2.x, sharpness);
            weights.y = pow(n2.y, sharpness);
            weights.z = pow(n2.z, sharpness);

            // float sharpness = 18.0;
            // vec3 weights = abs(pow3(n2, sharpness));

            // cheap 1 channel sample - creates some artifacts at cutoff zone
            // float cutoff = pow(sharpness, 1.0);
            // if(weights.z >cutoff*weights.x && weights.z > cutoff*weights.y){
            //   return ${sampler}${mixer}(map, csm_vWorldPosition.xy, scale);
            // }

            // if(weights.x >cutoff*weights.z && weights.x > cutoff*weights.y){
            //   return ${sampler}${mixer}(map, csm_vWorldPosition.zy, scale);
            // }

            // if(weights.y >cutoff*weights.z && weights.y > cutoff*weights.x){
            //   return ${sampler}${mixer}(map, csm_vWorldPosition.xz, scale);
            // }
            
            // expensive 3 channel blend
            vec3 xDiff = ${sampler}${mixer}(map, csm_vWorldPosition.zy , scale).xyz;
            vec3 yDiff = ${sampler}${mixer}(map, csm_vWorldPosition.xz  , scale).xyz;
            vec3 zDiff = ${sampler}${mixer}(map, csm_vWorldPosition.xy , scale).xyz;

            // weights[0] = 0.0;

            vec3 color = ${mixer}Mix(xDiff,yDiff,zDiff, weights);
            return vec4(color,1.0);
            
          }
          `
        }).join("\n")}

        vec3 calculateNormalsFromHeightMap(){
          float o = 0.5/${displacementWidth.toFixed(1)}; // step size
          float h = dot(texture2D(displacementMap, vUv),  vec4(1,0,0,1));
          float hx = dot(texture2D(displacementMap, vUv + vec2( o, 0.0 )), vec4(1,0,0,1));
          float hy = dot(texture2D(displacementMap, vUv + vec2( 0.0, o )),  vec4(1,0,0,1));
          float dScale = ${(props.displacementScale || 0).toFixed(20)};
          float dx = (hx - h) * dScale;
          float dy = (hy - h) * dScale;
          return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
        }

        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float splatWeights[${numSplatChannels}] = splat();

          n2 = calculateNormalsFromHeightMap();

          // Diffuse 
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

          // csm_DiffuseColor = texture2D(displacementMap, vUv);

          
          // Normal
          ${props.normalMap && glsl`
            csm_NormalMap = texture2D(normalMap, vUv).xyz;
            vec3 n = csm_NormalMap;

            ${props.surfaces.map((surface, i)=>{
              const index = i.toString();
              const normalStrength = (typeof surface.normalStrength === undefined ? 1 : surface.normalStrength).toFixed(8);
              if(normalStrength === (0).toFixed(8)) return null; // don't sample if strength is 0
              return glsl`n = NormalMix(n,  (${sample(i, 'Normal', 'normal' )}).xyz, splatWeights[${index}] * ${normalStrength});`
            }).filter(v=>v).join("\n")}

            csm_NormalMap = n;
            
          `}

          // Normal debug
          // csm_DiffuseColor = vec4(csm_NormalMap, 1.0);
        }
      `}
      patchMap={{
        csm_NormalMap: props.normalMap ? {
          "#include <normal_fragment_maps>": glsl`
            #ifdef OBJECTSPACE_NORMALMAP
              normal = csm_NormalMap * 2.0 - 1.0; // overrides both flatShading and attribute normals
              #ifdef FLIP_SIDED
                normal = - normal;
              #endif
              #ifdef DOUBLE_SIDED
                normal = normal * faceDirection;
              #endif
              normal = normalize( normalMatrix * normal );
              #elif defined( TANGENTSPACE_NORMALMAP )
                vec3 mapN = csm_NormalMap * 2.0 - 1.0;
                mapN.xy *= normalScale;
                #ifdef USE_TANGENT
                  normal = normalize( vTBN * mapN );
                #else
                  normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
                #endif
              #elif defined( USE_BUMPMAP )
                normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
              #endif
          `,
        } : {},
      }}
    />
  );
}


function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function removeDuplicated(values){
  const flag = {};
  const unique = [];
  values.map(object => {
    if(!flag[object.uuid]){
      flag[object.uuid] = true;
      unique.push(object)
    }
  })
  return unique;
}

function toObject(arr) {
  var rv = {};
  for (var i = 0; i < arr.length; ++i)
    rv[i] = arr[i];
  return rv;
}

function cartesian(args) {
  var r = [], max = args.length-1;
  function helper(arr, i) {
      for (var j=0, l=args[i].length; j<l; j++) {
          var a = arr.slice(0); // clone arr
          a.push(args[i][j]);
          if (i==max)
              r.push(a);
          else
              helper(a, i+1);
      }
  }
  helper([], 0);
  return r;
}