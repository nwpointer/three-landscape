import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import glsl from "glslify";
import { normalFunctions, colorFunctions, glslNoise } from "../util/util";
import { triplanarSamplers, aperiodicSamplers, basicSamplers } from "../util/samplers";
import mixers from "../util/mixers";
import sort from "../util/sort";
import { dynamicHeightUtils } from "../util/dynamicHeight";
import noise from "../util/noise";
import { memGenerateTextureArray } from "../util/generateTextureArray";
import { createMaterialScene } from "./createMaterialScene";
import { MeshStandardMaterialProps } from "@react-three/fiber";

export type Surface = {
  diffuse?: THREE.Texture;
  normal?: THREE.Texture;
  normalStrength?: Number;
  flipNormals?: boolean | number;
  repeat?: Number;
  saturation?: Number;
  tint?: THREE.Vector4;
  triplanar?: boolean;
  gridless?: boolean;
  aperiodic?: boolean;
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
  applyDefaultEncoding?: boolean;
  distanceTextureScale?: number;
  parent?: TerrainMaterial
  meshSize?: number
};

export default class TerrainMaterial extends CustomShaderMaterial {
  distantInstance: TerrainMaterial;
  key: string;
  far: number;
  farScene: THREE.Scene;
  farCamera: THREE.OrthographicCamera;
  farTargetDiffuse: THREE.WebGLRenderTarget;
  farTargetNormal: THREE.WebGLRenderTarget;
  farMaterial: any;
  renderer: THREE.WebGLRenderer;
  context: WebGLRenderingContext;
  macroMap: THREE.Texture;
  props: TerrainMaterialOptions;
  surfaceSamples: number;
  meshSize: number;

  constructor(props: TerrainMaterialOptions) {
    console.time('Terrain constructor');

    const [dw, dh] = [
      props?.displacementMap?.source?.data?.width ?? 0.0,
      props?.displacementMap?.source?.data?.height ?? 0.0
    ];

    // ensure information textures are interpreted linearly
    const applyDefaultEncoding = props.applyDefaultEncoding ?? true;
    if (props.displacementMap && applyDefaultEncoding)
      props.displacementMap.encoding = THREE.LinearEncoding;
    if (props.normalMap && applyDefaultEncoding)
      props.normalMap.encoding = THREE.LinearEncoding;

    const diffuseArray = memGenerateTextureArray(props.surfaces.map((surface) => surface.diffuse));
    const normalArray = memGenerateTextureArray(props.surfaces.map((surface) => surface.normal));

    super({
      normalMap: props.normalMap,
      displacementMap: props.displacementMap,
      displacementScale: 120 * 2,
      displacementBias: props.displacementBias,
      baseMaterial: THREE.MeshStandardMaterial,
      vertexShader: glsl`
        varying float z;
        varying vec3 uvz;
        varying vec3 heightNormal;

        uniform float smoothness;
        uniform vec2 displacementMapSize;
        uniform sampler2D[${props.splats.length || 1}] splats;

        #ifdef USE_DISPLACEMENTMAP
          ${dynamicHeightUtils}
        #endif
        
        void main(){
          #ifdef USE_DISPLACEMENTMAP
            z = texture(displacementMap, uv).r;
            csm_Position = vec3(position.xy, z*-displacementScale);
            
            if(smoothness > 0.0){
              z = getSmoothHeight(uv, displacementMapSize);
              heightNormal = calculateNormalsFromSmoothedHeightMap(displacementMap, displacementMapSize, uv);
            } else{
              heightNormal = calculateNormalsFromHeightMap(displacementMap, uv);
            }
            heightNormal = normalize(heightNormal);
            ${!props.parent && glsl`csm_Position.z += z * displacementScale;`}
          
          #else
            z = 0.0;
            heightNormal = vec3(0.5, 0.5, 1.0);
          #endif
          uvz = vec3(uv, z);
        }
      `,
      fragmentShader: glsl`
        precision highp sampler2DArray;

        varying vec3 heightNormal;
        varying vec3 uvz;
        float K; // random number

        uniform sampler2DArray diffuseArray;
        uniform sampler2DArray normalArray;
        uniform sampler2D macroMap;
        uniform sampler2D[${props.splats.length || 1}] splats;
        uniform float far;
        uniform bool farComputed;
        uniform float farRenderMode;
        uniform float displacementScale;
        uniform float meshSize;

        uniform sampler2D farDiffuseMap;
        uniform sampler2D farNormalMap;  
        #ifdef USE_FARMAPS
          bool distanceOptimized = true;
        #else
          bool distanceOptimized = false;
        #endif

        const int SURFACES = ${props.surfaces.length};
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
        uniform Surface[${props.surfaces.length}] surfaceData;
        uniform int surfaceSamples;
        uniform float[SURFACES] surfaceSaturation;
        uniform vec4[SURFACES] surfaceTint;
        uniform float[SURFACES] surfaceNormalY;

        // patch maps allow overriding of normalMaps
        vec4 csm_NormalColor;

        ${normalFunctions}
        ${colorFunctions}
        ${glslNoise}
        ${mixers}
        ${basicSamplers}
        ${aperiodicSamplers}
        ${triplanarSamplers}

        vec2[${props.splats.length * 4}] surfaces;
        void calculateSurfaces(vec2 uv){
          surfaces = vec2[${props.splats.length * 4}](
            ${Array(props.splats.length)
          .fill(0)
          .map((v, i) => {
            const index = i.toString();
            return glsl`
                vec2(${((i * 4 + 0) / 8.0).toString()}, texture2D(splats[${index}], uv).r),
                vec2(${(i * 4 + 1) / 8.0}, texture2D(splats[${index}], uv).g),
                vec2(${(i * 4 + 2) / 8.0}, texture2D(splats[${index}], uv).b),
                vec2(${(i * 4 + 3) / 8.0}, texture2D(splats[${index}], uv).a)`;
          })
          .join(",")}
          );
          ${sort("surfaces")}

          // normalize weights
          float weightSum = 0.0;
          for(int i = 0; i < surfaceSamples; i++) weightSum += surfaces[i].y;
          for(int i = 0; i < surfaceSamples; i++) surfaces[i].y /= weightSum;
        }
        
        vec4 calculateDiffuse(){
          vec4 color = vec4(0,0,0,0);
          for(int i = 0; i < surfaceSamples; i++){
            int index = int(surfaces[i].x * 8.0);
            vec3 uvi = vec3(uvz.xy, index);
            vec4 uvzi = vec4(uvz, index);
            float R = surfaceData[index].repeat;
            float F = surfaceData[index].flipNormals;
            float W = surfaces[i].y;
            bool aperiodic = surfaceData[index].aperiodic;
            bool triplanar = surfaceData[index].triplanar;
            vec2 repeat = R * vec2(1,F);
            vec3 scale = vec3(repeat, (displacementScale * R)/meshSize); // 1024 is the size of mesh
            // because the branch is based on a static uniform instead of a dynamic value, the compiler can optimize it out
            vec4 diffuse;
            if(aperiodic){
              if(triplanar){
                diffuse = TriplanarAperiodicLinearSample(diffuseArray, uvzi, scale, heightNormal, K);
              }else {
                diffuse = AperiodicLinearSample(diffuseArray, uvi,  R * vec2(1,F), K);
              }
            } else {
              if(triplanar){
                diffuse = TriplanarLinearSample(diffuseArray, uvzi, scale, heightNormal, K);
              }else {
                diffuse = LinearSample(diffuseArray, uvi,  R * vec2(1,F), K);
              }
            }
            // saturation & tint
            diffuse = saturation(diffuse, surfaceData[index].saturation);
            diffuse = diffuse * surfaceData[index].tint;
            
            // weight
            vec4 weightedDiffuse = diffuse * W;
            color += weightedDiffuse;
          }
          return color;
        }

        vec4 calculateNormal(){
          vec4 color = texture(normalMap, uvz.xy);
          for(int i = 0; i < surfaceSamples; i++){
            int index = int(surfaces[i].x * 8.0);
            vec3 uvi = vec3(uvz.xy, index);
            vec4 uvzi = vec4(uvz, index);
            float R = surfaceData[index].repeat;
            float F = surfaceData[index].flipNormals;
            float N = surfaceData[index].normalStrength;
            float W = surfaces[i].y;
            bool aperiodic = surfaceData[index].aperiodic;
            bool triplanar = surfaceData[index].triplanar;
            vec2 repeat = R * vec2(1,F);
            vec3 scale = vec3(repeat, (displacementScale * R)/meshSize); // 1024 is the size of mesh
            // because the branch is based on a static uniform instead of a dynamic value, the compiler can optimize it out
            vec4 normal;
            if(aperiodic){
              if(triplanar){
                normal = TriplanarAperiodicNormalSample(normalArray, uvzi, scale, heightNormal, K);
              }else {
                normal = AperiodicNormalSample(normalArray, uvi,  R * vec2(1,F), K);
              }
            } else {
              if(triplanar){
                normal = TriplanarNormalSample(normalArray, uvzi, scale, heightNormal, K);
              }else {
                normal = NormalSample(normalArray, uvi,  R * vec2(1,F), K);
              }
            }
            // weight
            vec4 weightedNormal = slerp(zeroN, normal, W * N);
            color = blend_rnm(color, weightedNormal);
          }
          return color;
        }
        
        void main(){
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          K = noise(vec3(uvz.xy*200.0, uvz.z));
          vec2 uv = uvz.xy;

          calculateSurfaces(uv);

          // need to use a js switch because CustomShaderMaterial does not know how to handle shaders with both csm_DiffuseColor and csm_FragColor
          ${!props.parent ? glsl`
            if(distanceOptimized && farComputed){
              vec4 farDiffuse = texture(farDiffuseMap, uvz.xy);
              // vec4 farDiffuse = vec4(1,0,0,1); // debug far distance
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
              csm_DiffuseColor = calculateDiffuse();
            }
          ` : glsl`
              // need to bypass lighting as it will be applied when sampled from the texture in the parent material instance so we directly set the frag color
              if(farRenderMode == 0.0){
                csm_FragColor = calculateDiffuse();
              } else {
                csm_FragColor = calculateNormal();
              }
          `}

          float sharpness = 10.0;          
        }
      `,
      patchMap: {
        csm_NormalColor: props.normalMap ? {
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
        } : {},
      },
      uniforms: {
        'farRenderMode': { value: 0.0 },
        'meshSize': { value: props.meshSize },
        'far': { value: props.far ?? 0 },
        'surfaceSamples': { value: props.surfaceSamples ?? 0 },
      },
    });

    console.timeEnd('Terrain constructor');

    const onBeforeCompile = this.onBeforeCompile;

    this.onBeforeCompile = (shader, renderer) => {
      this.context = renderer.getContext();

      const uniforms = {
        'splats': { value: props.splats },
        'noise': { value: props.noise ?? noise },
        'smoothness': { value: props.smoothness ?? 0.0 },
        'macroMap': { value: undefined },
        'weights': { value: props.weights },
        'indexes': { value: props.indexes },
        'aoMapIntensity': { value: props.aoMapIntensity ?? 0.5 },
        'roughness': { value: 0.0 },
        'normalMap': { value: props.normalMap },
        'displacementMap': { value: props.displacementMap },
        'displacementScale': { value: props.displacementScale ?? 0.0 },
        'envMapIntensity': { value: props.envMapIntensity ?? 0.0 },
        'metalness': { value: props.metalness ?? 0.0 },
        'aoMap ': { value: props.aoMap },
        'color': { value: new THREE.Color(props.color) },
        'displacementMapSize': { value: new THREE.Vector2(dw, dh) },
        'surfaceSamples': { value: props.surfaceSamples ?? 4.0 },
        'diffuseArray': { value: diffuseArray },
        'normalArray': { value: normalArray },
        'farDiffuseMap': { value: props.farDiffuseMap },
        'farNormalMap': { value: props.farDiffuseMap },
        'farComputed': { value: props.farComputed ?? false },
        'farRenderMode': { value: 0 },
        'far': { value: props.far ?? 100.0 },
        // vec4 requires default
        'surfaceData': {
          value: props.surfaces.map((surface, i) => {
            surface.tint = surface.tint ?? new THREE.Vector4(1, 1, 1, 1);
            surface.flipNormals = surface.flipNormals === true || surface.flipNormals === -1 ? -1 : 1;
            surface.saturation = surface.saturation ?? 0.5;
            return surface;
          }),
        },
        'surfaceNormalY': { value: props.surfaces.map(s => s.normal.y || 1) },
        'meshSize': { value: props.meshSize },
      };
      shader.uniforms = {
        ...shader.uniforms,
        ...uniforms
      };

      // keep custom props in sync
      (['far', 'smoothness', 'surfaceSamples', 'meshSize']).forEach(name =>Object.defineProperty(this, name, {
        get: () =>  shader.uniforms[name] !== undefined ? shader.uniforms[name].value : undefined,
        set: (v) => {
          if(shader.uniforms[name]){
            if(this.farMaterial) {
              this.farMaterial[name] = v
              this.generateFarMaps(renderer);
            }
            shader.uniforms[name].value = v
          }
        },
      }))
      onBeforeCompile(shader, renderer);
      if (props.distanceOptimized && !props.parent) {
        this.initializeFarMaps(props);
        this.generateFarMaps(renderer);
        // insure that the props with special setters get run if material is reconstructed
        this.anisotropy = props.anisotropy ?? 0;
        this.surfaces = props.surfaces ?? [];
      } else {
        // tell parent when far maps are ready
        if (props.parent && props.parent.uniforms.farComputed) {
          props.parent.uniforms.farComputed.value = true;
        }
      }
    };
  }

  // special setters
  set anisotropy(value) {
    const maps = [
      this.uniforms.farDiffuseMap,
      this.uniforms.farNormalMap,
      this.uniforms.diffuseArray,
      this.uniforms.normalArray
    ];
    for(const map of maps){
      if(map){
        map.value.anisotropy = value;
        map.value.needsUpdate = true;
      }
    }
  }

  set surfaces(value) {
    value = value.map((surface, i) => {
      surface.tint = surface.tint ?? new THREE.Vector4(1, 1, 1, 1);
      surface.flipNormals = surface.flipNormals === true || surface.flipNormals === -1 ? -1 : 1;
      surface.saturation = surface.saturation ?? 0.5;
      return surface;
    });
    if (this.uniforms.surfaceData) {
      this.uniforms.surfaceData.value = value;
    }
    if (this.distantInstance && this.distantInstance.uniforms.surfaceData) {
      this.distantInstance.uniforms.surfaceData.value = value;
    }
  }

  initializeFarMaps(props) {
    if (this.farMaterial)
      return; // already initialized
    this.farMaterial = new TerrainMaterial({ ...props, parent: this });
    const { camera, scene } = createMaterialScene(this.farMaterial);
    this.farCamera = camera;
    this.farScene = scene;
    const maxSize = this.getMaxTextureSize();
    const scale = props.distanceTextureScale ?? 1;
    let { width, height } = { width: maxSize * scale, height: maxSize * scale };
    this.farTargetDiffuse = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, encoding: THREE.LinearEncoding });
    this.farTargetNormal = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, encoding: THREE.LinearEncoding });
  }

  generateFarMaps(renderer) {
    const camera = this.farCamera;
    const scene = this.farScene;
    const diffuse = this.farTargetDiffuse;
    const normal = this.farTargetNormal;
    const material = this.farMaterial;

    material.uniforms.farRenderMode.value = 0;
    this.renderTexture(renderer, diffuse, scene, camera);
    this.uniforms.farDiffuseMap = { value: diffuse.texture };

    material.uniforms.farRenderMode.value = 1;
    material.uniforms.normalMap.value = this.uniforms.normalMap.value;
    this.renderTexture(renderer, normal, scene, camera);
    this.uniforms.farNormalMap = { value: normal.texture };

    this.needsUpdate = true;
  }

  getMaxTextureSize(context?) {
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
