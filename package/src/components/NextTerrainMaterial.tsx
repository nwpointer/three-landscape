import { shaderMaterial } from "../three/shaderMaterial"
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
// import { splatPreProcessMaterial } from "./splatPreProcessMaterial";
import noise from "../util/noise";
import { generateTextureArray, memGenerateTextureArray } from "../three/generateTextureArray";
import { useThree } from "@react-three/fiber";
import { farMaterial } from "../three/farMaterial";
import { materialScene } from "./../three/materialScene";

const STANDARD_MODE = 0;
const DISTANCE_DIFFUSE_MODE = 1;
const DISTANCE_NORMAL_MODE = 2;

/* ----------------------------
TODO:
[+] No more setters for everything
[+] Constructor perf issues
[+] FIX FLASH when switching to distance mode
[+] swap out 'macro' verbiage in initializer
[+] make renderMode parameter optional
[+] blend the near into the distance value
complete calculate distance and normal functions
see if we can get rid of props being passed to constructor
idea: to avoid creating two materials, could we reuse the parent and hotswap the the uniforms without causing a flash of distance texture in the near?
----------------------------- */

export type Surface = {
  diffuse?: THREE.Texture;
  normal?: THREE.Texture;
  normalStrength?: Number;
  flipNormals?: number;
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
    if(props.normalMap) temp.USE_NORMAL = 'true';
    if(props.smoothness) temp.USE_SMOOTHNESS = 'true';
    if(props.distanceOptimized) temp.USE_FARMAPS = 'true';
    if(props.macroMap) temp.USE_MACRO = 'true';
    if(props.weights && props.indexes) temp.USE_WEIGHTS_AND_INDEXES = 'true';
    return temp;
  }, [props.normalMap, props.smoothness, props.distanceOptimized, props.macroMap])

  // prevents constructor from running on prop changes, key is used to trigger reconstruction
  const args = useMemo(()=>{
    return [{...props}]
  }, [])

  //@ts-ignore
  return <terrainMaterial
    {...props}
    args={args}
    defines={defines}
    key={JSON.stringify({
      distanceOptimized: props.distanceOptimized,
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

        varying vec3 heightNormal;
        varying vec3 uvz;

        struct Surface {
          float normalStrength;
          bool flipNormals;
          float repeat;
          float saturation;
          vec4 tint;
          bool triplanar;
          int aperiodic;
          float displacementScale;
        };
        uniform Surface[1] surfaces;
        uniform sampler2DArray diffuseArray;
        uniform sampler2DArray normalArray;
        uniform sampler2D macroMap;
        uniform sampler2D[${props.splats.length || 1}] splats;
        uniform float far;
        uniform bool farComputed;
        uniform float farRenderMode;

        ${normalFunctions}

        uniform sampler2D farDiffuseMap;
        uniform sampler2D farNormalMap;  
        #ifdef USE_FARMAPS
          bool distanceOptimized = true;
        #else
          bool distanceOptimized = false;
        #endif

        vec4 calculateDiffuse(){
          return vec4(0,1.0,0,1);
        }
        vec4 calculateNormal(){
          return vec4(1,0,0,1);
        }
        
        void main(){
          float depth = gl_FragCoord.z / gl_FragCoord.w;

          csm_DiffuseColor = texture(diffuseArray, vec3(uvz.xy * 200.0, 0));

          // need to use a js switch because CustomShaderMaterial does not know how to handle shaders with both csm_DiffuseColor and csm_FragColor
          ${!props.parent ? glsl`
            if(distanceOptimized && farComputed){
              vec4 farDiffuse = texture(farDiffuseMap, uvz.xy);
              if(depth > far){
                csm_DiffuseColor = farDiffuse;
              } else {
                vec4 nearDiffuse = calculateDiffuse();
                float v = pow((depth / far), 10.0);
                csm_DiffuseColor = mix(nearDiffuse, farDiffuse, v);
              }
            } else {
              csm_DiffuseColor = calculateDiffuse();
            }
          ` : glsl`
              // need to bypass lighting as it will be applied when sampled from the texture
              if(farRenderMode == 0.0){
                csm_FragColor = calculateDiffuse();
              } else {
                csm_FragColor = calculateNormal();
              }
          ` }
        }
      `
    });

    this.uniforms = this.uniforms ?? {};
    this.uniforms.farRenderMode = {value: 0.0};

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
        })},
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
        // asynchronously create the distance optimized instance so it doesn't block initial render
        setTimeout(() => {
          this.initializeFarMaps(props, renderer);
          this.generateFarMaps(renderer);
        }, 17);
      } else {
        if(props.parent && props.parent.uniforms.farComputed){
          props.parent.uniforms.farComputed.value = true;
        }
      } 
    }
      

  }

  initializeFarMaps(props, renderer) {
    if(this.farMaterial) return; // already initialized
    this.farMaterial = new TerrainMaterial({...props, parent: this})
    const {camera, scene} = materialScene(this.farMaterial);
    this.farCamera = camera;
    this.farScene = scene;
    const maxSize = this.getMaxTextureSize();
    let {width, height} = {width:maxSize/4.0, height:maxSize/ 4.0};
    this.farTargetDiffuse = new THREE.WebGLRenderTarget(width, height, {depthBuffer: false, generateMipmaps: true});
    this.farTargetNormal = new THREE.WebGLRenderTarget(width, height, {depthBuffer: false, generateMipmaps: true});
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