import React, { useEffect, useMemo, useRef, useState } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture, sRGBEncoding } from "three";
import glsl from "glslify";
import noise from "./noise";
import { option, repeatTextures, srgbTextures, defined, colorFunctions, glslNoise, edgeBlend, luma, normalFunctions  } from './util.js'
import { Vector4, DataTexture, Mesh, PlaneGeometry, Scene, OrthographicCamera, WebGLRenderTarget, RGBAFormat, _SRGBAFormat, MeshBasicMaterial, ShaderMaterial, Color, DataArrayTexture, UnsignedByteType, LinearMipMapLinearFilter, NearestFilter } from 'three';
import TextureMerger from '../three/TextureMerger'
import { useThree, MeshStandardMaterialProps, useFrame } from "@react-three/fiber";

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

function generateAtlas(textures){
  const {width, height} = textures[0].image;
  const texturesData = new Uint8Array(width * height * 4 * textures.length);

  // for each texture in the textures array
  textures.forEach((texture, i) => {
    const data = _GetImageData(texture.image).data;
    const offset = i * width * height * 4;      
    texturesData.set(data, offset);
  })
      
  const atlas = new DataArrayTexture(texturesData, width, height, textures.length);
  atlas.needsUpdate = true;
  atlas.format = RGBAFormat;
  atlas.type = UnsignedByteType;
  atlas.minFilter = LinearMipMapLinearFilter;
  atlas.magFilter = NearestFilter;
  atlas.wrapS = RepeatWrapping;
  atlas.wrapT = RepeatWrapping;
  atlas.generateMipmaps = true;
  // set the mips and such
  return atlas
}

// Taken from https://github.com/mrdoob/three.js/issues/758
function _GetImageData( image ) {
  var canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  var context = canvas.getContext('2d');
  context.drawImage( image, 0, 0 );

  return context.getImageData( 0, 0, image.width, image.height );
}

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

function sort(arr="A"){
  return glsl`
    for(int i=1; i<${arr}.length(); i++){
      int j = i;
      // sorts vec2 by weight value [1]
      while(j > 0 && ${arr}[j-1][1] < ${arr}[j][1]){
        vec2 a = ${arr}[j]; 
        ${arr}[j] = ${arr}[j-1];
        ${arr}[j-1] = a; 
        j = j-1;
      }
    }
  `;
}

export default function TerrainMaterial(props: MeshStandardMaterialProps & {
  surfaces: Surface[];
  map?: Texture;
  splats: Texture[];
  noise?: Texture;
  displacementMap?: Texture;
  normalMap?: Texture;
  normalScale?: [Number, Number];
  displacementScale: Number;
  anisotropy:  Number | 'max';
  surfaceLimit: undefined | 1 | 2 | 3 | 4;
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
  let initialized = false
  // ----------------------------------------------------------------------------------------------------------------------------------------------------------

  const numSplats = props.splats.length;
  const numSplatChannels = props.splats.length * 4.0;
  const numSufaces = props.surfaces.length
  const displacementWidth = props.displacementMap.image.width;

  const [surfaceWeight, surfaceIndex] = useMemo(()=>{
    const [width, height] = [props.splats[0].image.width, props.splats[0].image.height];
    // const w = new Uint8Array(width * height * 4);
    // // initialize w with random colors
    // for(let i = 0; i < width * height; i++){
    //   w[i * 4 + 0] = Math.random() * 255;
    //   w[i * 4 + 1] = Math.random() * 255;
    //   w[i * 4 + 2] = Math.random() * 255;
    //   w[i * 4 + 3] = 255;
    // }
    // const surfaceWeight = new DataTexture(w, width, height);
    // // surfaceWeight.generateMipmaps = true;
    // surfaceWeight.needsUpdate = true;

    // const i = new Uint8Array(width * height * 4);
    // const surfaceIndex = new DataTexture(w, width, height);

    const surfaceWeight = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      stencilBuffer: false,
    });

    const surfaceIndex = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      stencilBuffer: false,
    });

    return [surfaceWeight, surfaceIndex];
  }, [])


  const [sampleCamera, sampleScene, mat] = useMemo(() => {
    const camera = new OrthographicCamera(-0.5, 0.5, -0.5, 0.5, 1, 10);
    camera.position.set(0, 0, 1);
    const scene = new Scene();
    const geo = new PlaneGeometry(1, 1);
    const uniforms = {
      uSplats: { value: props.splats },
      uMode: { value: 0 },
    }

    // const mat = new MeshBasicMaterial({color: 'green'});

    // basic ShaderMaterial that samples the first splatmap
    const mat = new ShaderMaterial({
      uniforms,
      vertexShader: glsl`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: glsl`
        uniform sampler2D uSplats[${numSplats}];
        uniform int uMode;
        varying vec2 vUv;
        void main() {
          vec4 color = texture(uSplats[1], vUv);
          
          // construct a array of vec2s with the index and weight of each surface from the splatmaps
          vec2[${numSplatChannels}] surfaces = vec2[${numSplatChannels}](
            ${Array(numSplats).fill(0).map((v,i) => {
              const index = i.toString()
              return glsl`
                vec2(${(i * 4 + 0).toString()}, texture(uSplats[${index}], vUv).r),
                vec2(${i * 4 + 1}, texture(uSplats[${index}], vUv).g),
                vec2(${i * 4 + 2}, texture(uSplats[${index}], vUv).b),
                vec2(${i * 4 + 3}, texture(uSplats[${index}], vUv).a)`
            }).join(',')}
          );

          ${sort("surfaces")}

          // x is the index, y is the weight
          if(uMode == 0){
            gl_FragColor = vec4(surfaces[0].x, surfaces[1].x, surfaces[2].x, surfaces[3].x);
          } else {
            gl_FragColor = vec4(surfaces[0].y, surfaces[1].y, surfaces[2].y, surfaces[3].y);
          }
        }
      `
    })
    const mesh = new Mesh(geo, mat);
    mesh.rotation.set(-Math.PI, 0, 0);
    scene.add(mesh);
    return [camera, scene, mat];
  }, []);
  
  useFrame(()=>{
    if(!initialized){
      
      // render weights to texture
      gl.setRenderTarget(surfaceWeight);
      gl.clear();
      mat.uniforms.uMode.value = 1; // weights
      gl.render(sampleScene, sampleCamera);

      // render indexes to texture
      gl.setRenderTarget(surfaceIndex);
      gl.clear();
      mat.uniforms.uMode.value = 0; // weights
      gl.render(sampleScene, sampleCamera);

      // gl.readRenderTargetPixels(surfaceBuffer, 0, 0, surfaceWeight.image.width, surfaceWeight.image.height, surfaceWeight.image.data);
      // surfaceWeight.needsUpdate = true;

      gl.setRenderTarget(null);
      

      // render indexes to texture

      initialized = true
    }
  })

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

  // todo check texture arrays for duplicates or maybe we don't care.
  const diffuseAtlas = useMemo(()=>generateAtlas(diffuse), [])
  const normalAtlas = useMemo(()=>generateAtlas(normal), [])

  console.log(normalAtlas, diffuseAtlas);
  
  


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



  // TODO: modify sampler to use the generated atlas

  const sample = (i, mixer="Linear", map="diffuse")=>{
    let color;
    const index = i.toString();
    const textureIndex = textureMap[i][map].id.toString();

    var map = map === "diffuse" ? `uDiffuse` :`uNormal`
    var uv = `vUv`
    
    // todo handle index -1?
    color = glsl`${triplanar[i] ? 'Tri':''}${gridless[i] ? 'Gridless':''}Sample${mixer}(${map}, vec3(${uv}, 0.0), uRepeat[${index}] )`
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
        uDiffuse: { value: diffuseAtlas },
        uNormal: { value: normalAtlas },
        uRepeat: { value: repeat },
        uSaturation: { value: saturation },
        // @ts-expect-error
        uTint: { value: tint, type:'vec4' },
        uAtlas: { value: atlas},
        uWeights: {value: surfaceWeight?.texture},
        uIndexes: {value: surfaceIndex?.texture},
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
          float h = dot(texture(displacementMap, uv),  vec4(1,0,0,1));
          float hx = dot(texture(displacementMap, uv + vec2( o, 0.0 )), vec4(1,0,0,1));
          float hy = dot(texture(displacementMap, uv + vec2( 0.0, o )),  vec4(1,0,0,1));
          float dScale = 150.0;
          float dx = (hx - h) * dScale;
          float dy = (hy - h) * dScale;
          return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
        }
        
        void main(){
          // csm_vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          // vec3 realPosition = position;
          // realPosition.z = (texture( displacementMap, uv ).x * displacementScale + displacementBias);

          // realPosition /= 1024.0;
          // csm_vWorldPosition = modelMatrix * vec4((realPosition), 1.0);

          vec3 realPosition = vec3(uv.xy, 1.0) ;
          realPosition.z = (texture( displacementMap, uv ).x * displacementScale) / 1024.0 ;
          csm_vWorldPosition = vec4((realPosition), 1.0);

          vGeometryNormal = calculateNormalsFromHeightMap();
        }
      `}
      fragmentShader={glsl`
        varying vec4 csm_vWorldPosition;
        varying vec3 csm_vNormal;
        varying vec3 vGeometryNormal;
        vec3 csm_NormalMap;
        
        precision highp float;
        precision highp int;
        precision highp sampler2DArray;

        uniform float uRepeat[${repeat.length}];
        uniform float uSaturation[${saturation.length}];
        uniform vec4 uTint[${tint.length}];
        
        // texture indexes
        uniform sampler2DArray uDiffuse;
        uniform sampler2DArray uNormal;

        uniform sampler2D uNoise;
        uniform sampler2D uSplats[${numSplats}];
        uniform sampler2D displacementMap;
        // uniform sampler2D normalMap; // is allready defined
        uniform sampler2DArray uTextures;
        uniform sampler2D uAtlas[1];

        uniform sampler2D uWeights;
        uniform sampler2D uIndexes;
        
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
          vec4 t0 = texture(uSplats[0], vUv);
          vec4 t1 = texture(uSplats[1], vUv);
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

        float[4] getSplatIndex(){
          float splatIndex[4];
          vec4 t = texture(uIndexes, vUv);
          splatIndex[0] = t.r;
          splatIndex[1] = t.g;
          splatIndex[2] = t.b;
          splatIndex[3] = t.a;
          return splatIndex;
        }


        float[4] getSplatWeight(){
          float splatWeight[4];
          vec4 t = texture(uWeights, vUv);
          splatWeight[0] = t.r;
          splatWeight[1] = t.g;
          splatWeight[2] = t.b;
          splatWeight[3] = t.a;
          return splatWeight;
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
            vec4 Sample${mixer}( sampler2DArray samp, vec3 uv, float scale){
              return texture(samp, vec3(uv.xy * scale, uv.z));
            }
          `;
        }).join("\n")}

        ${cartesian([['Linear', 'Normal']]).map(([mixer])=>{
          return glsl`
            vec4 GridlessSample${mixer}( sampler2DArray samp, vec3 uv, float scale ){
              uv = vec3(uv.xy * scale, uv.z);
              // sample variation pattern
              float k = texture( uNoise, 0.005*uv.xy ).x; // cheap (cache friendly) lookup
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
              vec2 dx = dFdx(uv.xy), dy = dFdy(uv.xy);
              // sample the two closest virtual patterns
              vec3 cola = textureGrad( samp, vec3(uv.xy + v*offa, uv.z), dx, dy ).xyz;
              vec3 colb = textureGrad( samp, vec3(uv.xy + v*offb, uv.z), dx, dy ).xyz;
    
              // interpolate between the two virtual patterns
              vec3 color = ${mixer}Mix(cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
              return vec4(color,1.0);
            }
          `;
        }).join("\n")}

        ${cartesian([['GridlessSample', 'Sample'], ['Linear', 'Normal']]).map(([sampler, mixer])=>{
          return glsl`
          vec4 Tri${sampler}${mixer}(sampler2DArray map, vec3 uv, float scale){
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
            vec3 xDiff = ${sampler}${mixer}(map, vec3(csm_vWorldPosition.zy, uv.z) , scale).xyz;
            vec3 yDiff = ${sampler}${mixer}(map, vec3(csm_vWorldPosition.xz, uv.z)  , scale).xyz;
            vec3 zDiff = ${sampler}${mixer}(map, vec3(csm_vWorldPosition.xy, uv.z) , scale).xyz;

            // weights[0] = 0.0;

            vec3 color = ${mixer}Mix(xDiff,yDiff,zDiff, weights);
            return vec4(color,1.0);
            
          }
          `
        }).join("\n")}

        vec3 calculateNormalsFromHeightMap(){
          float o = 0.5/${displacementWidth.toFixed(1)}; // step size
          float h = dot(texture(displacementMap, vUv),  vec4(1,0,0,1));
          float hx = dot(texture(displacementMap, vUv + vec2( o, 0.0 )), vec4(1,0,0,1));
          float hy = dot(texture(displacementMap, vUv + vec2( 0.0, o )),  vec4(1,0,0,1));
          float dScale = ${(props.displacementScale || 0).toFixed(20)};
          float dx = (hx - h) * dScale;
          float dy = (hy - h) * dScale;
          return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
        }

        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float splatIndexes[4] = getSplatIndex();
          float splatWeights[4] = getSplatWeight();

          n2 = calculateNormalsFromHeightMap();
          // n2 = texture(normalMap, vUv).xyz;
          
          // Diffuse 
          // for each diffuse channel
          for(int i = 0; i < 4; i++){
            float weight = splatWeights[i];
            float index = splatIndexes[i];
            // texture(uDiffuse, vec3(vUv * 300.0, 4.0)) * vec4(0.25, 0.25, 0.25, 1.0)
            csm_DiffuseColor += texture(uDiffuse, vec3(vUv * 300.0, index)) * weight;
          }

          // csm_DiffuseColor = vec4(splatIndexes[0],splatIndexes[1],splatIndexes[2],splatIndexes[3]);

          csm_DiffuseColor = normalize(csm_DiffuseColor);


          
          // Normal


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