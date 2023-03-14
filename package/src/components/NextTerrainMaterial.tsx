import { extend } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { MeshStandardMaterialProps } from "@react-three/fiber";
import glsl from "glslify";
import { normalFunctions, colorFunctions, glslNoise } from "../util/util";
import { triplanar, biplanar, aperiodic, samplers } from "../util/samplers";
import mixers from "../util/mixers";
import sort from "../util/sort";
import { dynamicHeightUtils } from "../util/dynamicHeight";
import noise from "../util/noise";
import { generateTextureArray, memGenerateTextureArray } from "../three/generateTextureArray";
import { materialScene } from "./../three/materialScene";

/* ----------------------------
TODO:
[+] No more setters for everything
[+] Constructor perf issues
[+] FIX FLASH when switching to distance mode
[+] swap out 'macro' verbiage in initializer
[+] make renderMode parameter optional
[+] blend the near into the distance value
[+] Fix anisotropic filtering
[+] Fix normal map being unavailable in distance mode
[ ] Make distance size configurable
[ ] complete calculate distance and normal functions
----------------------------- */

export type Surface = {
  diffuse?: THREE.Texture;
  normal?: THREE.Texture;
  normalStrength?: Number;
  flipNormals?: boolean;
  repeat?: Number;
  saturation?: Number;
  tint?: THREE.Vector4;
  triplanar?: boolean;
  gridless?: boolean;
  displacement?: THREE.Texture;
  displacementScale?: number;
};

export type TerrainMaterialOptions = MeshStandardMaterialProps & {
  surfaces: Surface[];
  splats: THREE.Texture[];
  noise?: THREE.Texture;
  anisotropy?: number | "max";
  smoothness?: number;
  surfaceSamples?: number;
  macroMap?: THREE.Texture;
  distanceOptimized?: boolean;
  far: number;
  weights?: THREE.Texture;
  indexes?: THREE.Texture;
};

export default function(props: TerrainMaterialOptions){
  extend({ TerrainMaterial })
  
  // defines are passed to shaders
  const defines = useMemo(()=>{
    const temp ={} as {[key: string]: string}
    // if(props.normalMap) temp.USE_NORMALMAP = 'true';
    if(props.smoothness) temp.USE_SMOOTHNESS = 'true';
    if(props.distanceOptimized) temp.USE_FARMAPS = 'true';
    if(props.macroMap) temp.USE_MACRO = 'true';
    if(props.weights && props.indexes) temp.USE_WEIGHTS_AND_INDEXES = 'true';
    return temp;
  }, [props.normalMap, props.smoothness, props.distanceOptimized, props.macroMap])

  // prevents constructor from running on prop changes, key is used to trigger reconstruction
  // const args = useMemo(()=>{
  //   return [{...props}]
  // }, [])

  //@ts-ignore
  return <terrainMaterial
    {...props}
    args={[{...props}]}
    defines={defines}
    key={JSON.stringify({
      distanceOptimized: props.distanceOptimized,
      displacementMap: props.displacementMap,

    })} 
  />
}

class TerrainMaterial extends CustomShaderMaterial{
  distantInstance: TerrainMaterial
  key: string
  farScene: THREE.Scene
  farCamera: THREE.OrthographicCamera
  farTargetDiffuse: THREE.WebGLRenderTarget
  farTargetNormal: THREE.WebGLRenderTarget
  farMaterial: any
  renderer: THREE.WebGLRenderer
  context: WebGLRenderingContext
  macroMap: THREE.Texture
  props: TerrainMaterialOptions

  constructor(props){
    console.time('Terrain constructor')

    const [dw, dh] = [
      props?.displacementMap?.source?.data?.width ?? 0.0,
      props?.displacementMap?.source?.data?.height ?? 0.0
    ]

    const diffuseArray = memGenerateTextureArray(props.surfaces.map((surface) => surface.diffuse));
    const normalArray = memGenerateTextureArray(props.surfaces.map((surface) => surface.normal));

    super({
      baseMaterial: THREE.MeshStandardMaterial,
      uniforms: {
        'surfaceTint': {value: props.surfaces.map(s => s.tint || new THREE.Vector4(1, 1, 1, 1))}
      },
      vertexShader: glsl`
        varying float z;
        varying vec3 uvz;
        varying vec3 heightNormal;

        uniform float smoothness;
        uniform vec2 displacementSize;
        uniform sampler2D[${props.splats.length || 1}] splats;
        
        #ifdef USE_DISPLACEMENTMAP
          ${dynamicHeightUtils}
        #endif
        
        void main(){
          #ifdef USE_DISPLACEMENTMAP
            float z = texture(displacementMap, uv).r;
            csm_Position = vec3(position.xy, z*-displacementScale);
            csm_Position.z += z * displacementScale;

            // if smoothnes...

            heightNormal = calculateNormalsFromHeightMap(displacementMap, uv);
            heightNormal = normalize(heightNormal.rgb) * 4.0;
          #else
            z = 0.0;
          #endif
          uvz = vec3(uv, z);
        }
      `,
      fragmentShader: glsl`
        precision mediump sampler2DArray;
        const int SURFACES = ${props.surfaces.length};

        varying vec3 heightNormal;
        varying vec3 uvz;

        struct Surface {
          float normalStrength;
          float flipNormals;
          float repeat;
          float saturation;
          vec4 tint;
          bool triplanar;
          bool aperiodic;
          float displacementScale;
        };

        uniform Surface[${props.surfaces.length}] surfaces;
        uniform int surfaceSamples;
        uniform sampler2DArray diffuseArray;
        uniform sampler2DArray normalArray;
        uniform sampler2D macroMap;
        uniform sampler2D[${props.splats.length || 1}] splats;
        uniform float far;
        uniform bool farComputed;
        uniform float farRenderMode;
        uniform float[SURFACES] surfaceSaturation;
        uniform vec4[SURFACES] surfaceTint;

        // not sure why but the child material is missing this uniform
        ${props.parent && glsl`
          uniform sampler2D normalMap;
        `}

        // patch maps
        vec4 csm_NormalColor;

        ${normalFunctions}
        ${colorFunctions}
        ${glslNoise}

        ${mixers}
        ${samplers}
        ${aperiodic}
        
        uniform sampler2D farDiffuseMap;
        uniform sampler2D farNormalMap;  
        #ifdef USE_FARMAPS
          bool distanceOptimized = true;
        #else
          bool distanceOptimized = false;
        #endif

        float k;

        float weightSum = 0.0;
        vec2[${props.splats.length * 4}] sortedSurfaces;

        vec2[${props.splats.length * 4}] sortSurfaces (vec2 uv){
          vec2[${props.splats.length * 4}] surfaces = vec2[${props.splats.length * 4}](
            ${Array(props.splats.length)
              .fill(0)
              .map((v, i) => {
                const index = i.toString();
                return glsl`
                vec2(${((i * 4 + 0) / 8.0).toString()}, texture2D(splats[${index}], uv).r),
                vec2(${(i * 4 + 1)/ 8.0}, texture2D(splats[${index}], uv).g),
                vec2(${(i * 4 + 2)/ 8.0}, texture2D(splats[${index}], uv).b),
                vec2(${(i * 4 + 3)/ 8.0}, texture2D(splats[${index}], uv).a)`;
                })
              .join(",")}
          );
          ${sort("surfaces")}

          // normalize weights
          weightSum = 0.0;
          for(int i = 0; i < surfaceSamples; i++) weightSum += surfaces[i].y;
          return surfaces;
        }

        vec4 calculateDiffuse(){
          vec4 diffuse;
          for(int i = 0; i < surfaceSamples; i++){
            int index = int(sortedSurfaces[i].x * 8.0);
            float R = surfaces[index].repeat;
            float W = sortedSurfaces[i].y / weightSum;
            bool aperiodic = surfaces[index].aperiodic;
            bool triplanar = surfaces[index].triplanar;

            vec3 uvi = vec3(uvz.xy*R, float(index));

            // return texture(normalMap, uvz.xy)
            vec4 D = texture(diffuseArray, uvi);
            // vec4 D = vec4(surfaces[index].saturation, 0,0,1);
            diffuse += D * W;

            // tint and saturation
            // diffuse = saturation(diffuse, surfaces[index].saturation);
            // diffuse = diffuse * surfaces[index].tint;
            // diffuse = diffuse * surfaceTint[index];

            // return LinearSample(diffuseArray, uvi, R * vec2(1,N), k);
          }
          return diffuse;
          // return texture(splats[0], uvz.xy);
        }
        vec4 calculateNormal(){
          vec4 normal = texture(normalMap, uvz.xy);
          // for(int i = 0; i < surfaceSamples; i++){
          //   int index = int(sortedSurfaces[i].x * 8.0);
          //   float J = surfaces[0].normalStrength;
          //   float F = surfaces[index].flipNormals;
          //   float R = surfaces[index].repeat;
          //   float S = surfaces[index].saturation;
          //   vec4 T = surfaces[index].tint;
          //   float W = sortedSurfaces[i].y / weightSum;
          //   bool aperiodic = surfaces[index].aperiodic;
          //   bool triplanar = surfaces[index].triplanar;

          //   vec3 uvi = vec3(uvz.xy*R * vec2(1, F), float(index));

          //   // return texture(normalMap, uvz.xy)
          //   vec4 N = slerp(zeroN, texture(normalArray, uvi), W * J);
          //   normal = blend_rnm(normal, N);

          //   // return LinearSample(NormalArray, uvi, R * vec2(1,N), k);
          // }
          return normal;
        }

        // problem: far texture wants to only calculate the normal or diffuse, not both
        // the near texture wants to calculate both inside one loop
        
        void main(){
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          sortedSurfaces = sortSurfaces(uvz.xy);
          k = noise(vec3(uvz.xy*200.0, uvz.z));
          
          // need to use a js switch because CustomShaderMaterial does not know how to handle shaders with both csm_DiffuseColor and csm_FragColor
          ${!props.parent ? glsl`
            if(distanceOptimized && farComputed){
              vec4 farDiffuse = texture(farDiffuseMap, uvz.xy);
              vec4 farNormal = texture(farNormalMap, uvz.xy);
              csm_DiffuseColor = farDiffuse;
              csm_NormalColor = farNormal;
              if(depth < far){
                float v = pow((depth / far), 10.0);
                vec4 nearDiffuse = calculateDiffuse();
                csm_DiffuseColor = mix(nearDiffuse, farDiffuse, v);
                vec4 nearNormal = calculateNormal();
                csm_NormalColor = mix(nearNormal, farNormal, v);
              }
            } else {
              csm_NormalColor = calculateNormal();
              // csm_DiffuseColor = calculateDiffuse();
              csm_DiffuseColor = texture(splats[1], uvz.xy);
            }
          ` : glsl`
              // need to bypass lighting as it will be applied when sampled from the texture in the parent material instance
              if(farRenderMode == 0.0){
                csm_FragColor = calculateDiffuse();
              } else {
                csm_FragColor = calculateNormal();
              }
          ` }
        }
      `,
      patchMap: {
        csm_NormalColor: !props.normalMap ? {} : {
          "#include <normal_fragment_maps>": glsl`
            #ifdef OBJECTSPACE_NORMALMAP
              normal = csm_NormalColor.xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
              #ifdef FLIP_SIDED
                normal = - normal;
              #endif
              #ifdef DOUBLE_SIDED
                normal = normal * faceDirection;
              #endif
              normal = normalize( normalMatrix * normal );
              #elif defined( TANGENTSPACE_NORMALMAP )
                vec3 mapN = csm_NormalColor.xyz * 2.0 - 1.0;
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
        },
      }
    });

    this.uniforms = this.uniforms ?? {};
    this.uniforms.farRenderMode = {value: 0.0};

    this.defines = this.defines ?? {};
    this.defines.USE_NORMAL = 1;

    console.timeEnd('Terrain constructor')

    const onBeforeCompile = this.onBeforeCompile;

    this.onBeforeCompile = (shader, renderer)=>{
      this.context = renderer.getContext();
      
      const uniforms = {
        'splats': {value: props.splats },
        'noise': {value: props.noise ?? noise},
        'smoothness': {value: props.smoothness ?? 0.0},
        'macroMap': {value: undefined},
        'weights': {value: props.weights},
        'indexes': {value:props.indexes},
        'aoMapIntensity': {value: props.aoMapIntensity ?? 0.5},
        'roughness': {value:0.0},
        'normalMap': {value: props.normalMap},
        'displacementMap': {value: props.displacementMap},
        'displacementScale': {value: props.displacementScale ?? 0.0},
        'envMapIntensity': {value: props.envMapIntensity ?? 0.0},
        'metalness': {value: props.metalness ?? 0.0},
        'aoMap ': {value: props.aoMap},
        'color': {value: new THREE.Color(props.color)},
        'displacementSize': {value: new THREE.Vector2(dw, dh)},
        'surfaceSamples': {value: props.surfaceSamples ?? 4.0},
        'diffuseArray': { value: diffuseArray},
        'normalArray': { value: normalArray},
        'farDiffuseMap': {value: props.farDiffuseMap},
        'farNormalMap': {value: props.farDiffuseMap},
        'farComputed': {value: props.farComputed ?? false},
        'farRenderMode': {value:0},
        'far': {value: props.far ?? 100.0},
        // vec4 requires default
        'surfaces': {value:props.surfaces.map(surface => {
          surface.tint = surface.tint ?? new THREE.Vector4(1,1,1,1)
          surface.flipNormals = surface.flipNormals ? -1 : 1;
          surface.saturation = surface.saturation ?? 0.5;
          return surface
        })},
        // 'surfaceTint': {value: props.surfaces.map(s => new THREE.Vector4(1, 1, 1, 1))}
      }
      shader.uniforms = { ...shader.uniforms,
        ...uniforms
      };

      // keep uniforms of distanceInstance in sync
      // (Object.keys(shader.uniforms)).forEach(name =>Object.defineProperty(this, name, {
      //   get: () =>  shader.uniforms[name] !== undefined ? shader.uniforms[name].value : undefined,
      //   set: (v) => {
      //     // console.log(name, v)
      //     if(shader.uniforms[name]){
      //       shader.uniforms[name].value = v
      //       if(this.distantInstance) this.distantInstance[name] = v
      //     }
      //   },
      // }))
      
      onBeforeCompile(shader, renderer);
      if(props.distanceOptimized && !props.parent){
        // optionally asynchronously create the distance optimized instance so it doesn't block initial render
        // setTimeout(() => {
          this.initializeFarMaps(props, renderer);
          this.generateFarMaps(renderer);
          // insure that the setters get run if material is reconstructed
          this.anisotropy = props.anisotropy ?? 0;
        // }, 17);
      } else {
        if(props.parent && props.parent.uniforms.farComputed){
          props.parent.uniforms.farComputed.value = true;
        }
      }
      this.far = props.far ?? 0;
      this.surfaceSamples = props.surfaceSamples ?? 0;
    }
  }

  set anisotropy(value){
    // todo: set anisotropy on all textures
    if(this.uniforms.farDiffuseMap) this.uniforms.farDiffuseMap.value.anisotropy = value;
    if(this.uniforms.farNormalMap) this.uniforms.farNormalMap.value.anisotropy = value;
    if(this.uniforms.diffuseArray) this.uniforms.diffuseArray.value.anisotropy = value;
    if(this.uniforms.normalArray) this.uniforms.normalArray.value.anisotropy = value;
    if(this.uniforms.farDiffuseMap) this.uniforms.farDiffuseMap.value.needsUpdate = true;
    if(this.uniforms.farNormalMap) this.uniforms.farNormalMap.value.needsUpdate = true;
    if(this.uniforms.diffuseArray) this.uniforms.diffuseArray.value.needsUpdate = true;
    if(this.uniforms.normalArray) this.uniforms.normalArray.value.needsUpdate = true;
  }

  set far(value){
    if(this.uniforms.far){
      this.uniforms.far.value = value;
    }
    if(this.distantInstance && this.distantInstance.uniforms.far){
      this.distantInstance.uniforms.far.value = value;
    }
  }

  set surfaceSamples(value){
    if(this.uniforms.surfaceSamples){
      this.uniforms.surfaceSamples.value = value;
    }
    if(this.distantInstance && this.distantInstance.uniforms.surfaceSamples){
      this.distantInstance.uniforms.surfaceSamples.value = value;
    }
  }

  initializeFarMaps(props, renderer) {
    if(this.farMaterial) return; // already initialized
    this.farMaterial = new TerrainMaterial({...props, parent: this})
    const {camera, scene} = materialScene(this.farMaterial);
    this.farCamera = camera;
    this.farScene = scene;
    const maxSize = this.getMaxTextureSize();
    let {width, height} = {width:maxSize, height:maxSize};
    this.farTargetDiffuse = new THREE.WebGLRenderTarget(width, height, {depthBuffer: false, format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter});
    this.farTargetNormal = new THREE.WebGLRenderTarget(width, height, {depthBuffer: false, format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter});
  }

  generateFarMaps(renderer) {
    const camera = this.farCamera;
    const scene = this.farScene;
    const diffuse = this.farTargetDiffuse;
    const normal = this.farTargetNormal;
    const material = this.farMaterial;

    material.uniforms.farRenderMode.value = 0;
    this.renderTexture(renderer, diffuse, scene, camera);
    this.uniforms.farDiffuseMap = {value: diffuse.texture};
    
    material.uniforms.farRenderMode.value = 1;
    material.uniforms.normalMap.value = this.uniforms.normalMap.value;
    this.renderTexture(renderer, normal, scene, camera);
    this.uniforms.farNormalMap = {value: normal.texture};

    this.needsUpdate = true;
  }

  getMaxTextureSize(context?){
    const ctx = context ?? this.context;
    return ctx.getParameter(ctx.MAX_TEXTURE_SIZE);
  }

  renderTexture(renderer, target, scene, camera) {
    target.texture.needsUpdate = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }
}