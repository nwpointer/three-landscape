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
import { MacroMaterial } from "../three/MacroMaterial";
import { materialScene } from "./../three/materialScene";

const STANDARD_MODE = 0;
const DISTANCE_DIFFUSE_MODE = 1;
const DISTANCE_NORMAL_MODE = 2;

/* ----------------------------
TODO:
[+] Constructor perf issues
[] FIX FLASH when switching to distance mode
swap out 'macro' verbiage in initializer
[+] make renderMode parameter optional
blend the near into the distance value
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
    if(props.distanceOptimized) temp.USE_DISTANCE_TEXTURE = 'true';
    if(props.macroMap) temp.USE_MACRO = 'true';
    if(props.weights && props.indexes) temp.USE_WEIGHTS_AND_INDEXES = 'true';
    return temp;
  }, [props.normalMap, props.smoothness, props.distanceOptimized, props.macroMap])

  //@ts-ignore
  return <terrainMaterial
    {...props}
    args={[{...props},true]}
    defines={defines}
    key={JSON.stringify({
      distanceOptimized: props.distanceOptimized,
    })} 
  />
}

class TerrainMaterial extends CustomShaderMaterial{
  distantInstance: TerrainMaterial
  key: string
  macroScene: THREE.Scene
  macroCamera: THREE.OrthographicCamera
  macroTarget: THREE.WebGLRenderTarget
  macroMaterial: any
  renderer: THREE.WebGLRenderer
  context: WebGLRenderingContext
  macroMap: THREE.Texture
  props: TerrainMaterialOptions

  constructor(props){
    console.time('constructor')

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

        ${normalFunctions}

        uniform sampler2D distanceTexture;  
        #ifdef USE_DISTANCE_TEXTURE
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
            if(distanceOptimized && depth > far){
              csm_DiffuseColor = texture(macroMap, uvz.xy);
            } else {
              csm_DiffuseColor = calculateDiffuse();
            }
          ` : glsl`
            // need to bypass lighting as it will be applied when sampled from the texture
            csm_FragColor = vec4(1,0,0,1);
          ` }
        }
      `
    });

    // // keep uniforms of distanceInstance in sync
    // (Object.keys(this.uniforms)).forEach(name =>Object.defineProperty(this, name, {
    //   get: () =>  this.uniforms[name] !== undefined ? this.uniforms[name].value : undefined,
    //   set: (v) => {
    //     // console.log(name, v)
    //     if(this.uniforms[name]){
    //       this.uniforms[name].value = v
    //       if(this.distantInstance) this.distantInstance[name] = v
    //     }
    //   },
    // }))

    console.timeEnd('constructor')

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
        'distanceTexture': {value: props.distanceTexture},
        'far': {value: props.far ?? 100.0},
        // vec4 requires default
        'surfaces': {value:props.surfaces.map(surface => {
          surface.tint = surface.tint ?? new THREE.Vector4(1,1,1,1)
        })},
      }
      shader.uniforms = { ...shader.uniforms,
        ...uniforms
      };
      onBeforeCompile(shader, renderer);
        if(props.distanceOptimized && !props.parent){
        // asynchronously create the distance optimized instance so it doesn't block initial render
        setTimeout(() => {
          // console.log('heya')
          this.initializeMacroMaps(props, renderer);
          this.generateMacroMap(renderer);
        }, 17);
      }

    }

  }

  initializeMacroMaps(props, renderer) {
    if(this.macroMaterial) return; // already initialized
    this.macroMaterial = new TerrainMaterial({...props, parent: this})
    const {camera, scene} = materialScene(this.macroMaterial);
    this.macroCamera = camera;
    this.macroScene = scene;
    const maxSize = this.getMaxTextureSize();
    let {width, height} = {width:maxSize/4.0, height:maxSize/ 4.0};
    this.macroTarget = new THREE.WebGLRenderTarget(width, height, {depthBuffer: false, generateMipmaps: true});
  }

  generateMacroMap(renderer) {
    const camera = this.macroCamera;
    const scene = this.macroScene;
    const target = this.macroTarget;
    this.renderTexture(renderer, target, scene, camera);
    this.macroMap = target.texture;
    this.uniforms = this.uniforms ?? {};
    this.uniforms.macroMap = {value: this.macroMap};
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