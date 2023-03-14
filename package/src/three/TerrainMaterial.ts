import CustomShaderMaterial, { iCSMUpdateParams } from "three-custom-shader-material/vanilla";
import { Texture, Scene, Color, MeshBasicMaterial, LinearFilter, WebGLRenderer, OrthographicCamera, WebGLRenderTarget, MeshStandardMaterial, DataArrayTexture, RGBAFormat,NearestFilter,LinearMipmapLinearFilter, LinearMipmapNearestFilter, Vector4 } from "three";
import glsl from "glslify";
import { MeshStandardMaterialProps } from "@react-three/fiber";
import { normalFunctions, colorFunctions, glslNoise } from "../util/util";
import { triplanar, biplanar, aperiodic, samplers } from "../util/samplers";
import mixers from "../util/mixers";
import sort from "../util/sort";
import { dynamicHeightUtils } from "../util/dynamicHeight";
import { splatPreProcessMaterial } from "./splatPreProcessMaterial";
import noise from "../util/noise";
import { ShaderMaterial } from "three";
import { DistanceMaterial } from "./DistanceMaterial";
import { MacroMaterial } from "./MacroMaterial";
import { generateTextureArray } from "./generateTextureArray";
import { materialScene } from "./materialScene";

export type Surface = {
  diffuse: Texture;
  normal?: Texture;
  normalStrength?: Number;
  normalY?: number;
  repeat?: Number;
  saturation?: Number;
  tint?: Vector4;
  splatId?: Number;
  triplanar?: boolean;
  gridless?: boolean;
  displacement?: Texture;
  displacementScale?: number;
};

export type TerrainMaterialOptions = MeshStandardMaterialProps & {
  surfaces: Surface[];
  splats: Texture[];
  noise?: Texture;
  displacementMap: Texture;
  normalMap: Texture;
  normalScale?: [number, number];
  displacementScale?: number;
  anisotropy?: number | "max";
  smoothness?: number;
  surfaceSamples?: number;
  macroMap?: Texture;
  useMacro?: boolean;
  distanceOptimizedRendering?: boolean;
  precalculateWeights?: boolean;
  weights?: Texture;
  indexes?: Texture;
};

const textureCache = {};

class TerrainMaterial extends CustomShaderMaterial {
  props: TerrainMaterialOptions;
  renderSplats: Function;
  diffuseArray: DataArrayTexture;
  normalArray: DataArrayTexture;
  renderer: WebGLRenderer;
  context: WebGLRenderingContext;
  // render texture resources:
  macroMaterial: ShaderMaterial;
  macroTarget: WebGLRenderTarget;
  macroScene: Scene;
  macroCamera: OrthographicCamera;
  distanceMaterial: ShaderMaterial;
  distanceDiffuseTarget: WebGLRenderTarget;
  distanceNormalTarget: WebGLRenderTarget;
  distanceScene: Scene;
  distanceCamera: OrthographicCamera;
  
  constructor(props = {} as any, renderer: WebGLRenderer) {
    props.uniforms = props.uniforms || {};

    if(!props.surfaces || props.surfaces.length < 1) {
      throw new Error("TerrainMaterial: surfaces must be an array with at least one surface");
    }

    if(!props.normalMap) {
      throw new Error("TerrainMaterial: normalMap is currently required, this requirement will be relaxed in a future release");
    }

    if(!props.displacementMap) {
      throw new Error("TerrainMaterial: displacementMap is currently required, this requirement will be relaxed in a future release");
    }

    // todo: remove duplicates, would reduce memory usage
    const {diffuseArray, normalArray} = TerrainMaterial.preprocessSurfaces(props.surfaces, false);
    const {weights, indexes} = props.precalculateWeights ? TerrainMaterial.preprocessSplats(props, renderer, false) : {weights: null, indexes: null};

    props.distanceOptimizedRendering = props.distanceOptimizedRendering ?? true;
    
    const uniforms = {
      ...props.uniforms,
      aoMapIntensity: { value: props.aoMapIntensity || 0 },
      diffuseArray: { value: diffuseArray },
      uNoise: { value: props.noise || noise },
      normalArray: { value: normalArray },
      weights: { value: props.weights ?? weights?.texture },
      indexes: { value: props.indexes ?? indexes?.texture },
      splats: { value: props.splats },
      displacementMap: { value: props.displacementMap },
      displacementSize: { value: [props?.displacementMap?.image?.width, props?.displacementMap?.image?.height] },
      smoothness: { value: props.smoothness },
      surfaceSamples: { value: props.surfaceSamples ?? 4.0 },
      distanceDiffuseMap: { value: undefined },
      distanceNormalMap: { value: undefined },
      macroMap: { value: undefined },
      diffuseMode: { value: false },
      normalMode: { value: false },
      useMacro: { value: false },
      distanceOptimizedRendering: { value: props.distanceOptimizedRendering },
      distant: { value: 150.0 },

      // surface props
      surfaceNormalStrength: { value: props.surfaces.map(s => s.normalStrength || 1) },
      surfaceNormalY: { value: props.surfaces.map(s => s.normalY || 1 ) },
      surfaceRepeat: { value: props.surfaces.map(s => s.repeat || 1) },
      surfaceGridless: { value: props.surfaces.map(s => s.gridless || false) },
      surfaceTriplanar: { value: props.surfaces.map(s => s.triplanar || false) },
      surfaceTint: { value: props.surfaces.map(s => s.tint || new Vector4(1, 1, 1, 1)) },
      surfaceSaturation: { value: props.surfaces.map(s => s.saturation || 0.5) }
    };

    const vertexShader = glsl`
      uniform float smoothness;
      uniform vec2 displacementSize;
      varying float vZ;
      varying vec3 vHeightNormal;

      ${dynamicHeightUtils}

      void main(){

        // vHeightNormal = calculateNormalsFromSmoothedHeightMap(displacementMap, uv);
        vHeightNormal = calculateNormalsFromHeightMap(displacementMap, uv);

        float h = getSmoothHeight(uv);
        vZ = texture( displacementMap, uv ).r;

        csm_Position = position;
        csm_Position.z = texture( displacementMap, uv ).r * - displacementScale;
        csm_Position.z += h * displacementScale;

      }
    `

    const fragmentShader = glsl`
      const int SURFACES = ${props.surfaces.length};

      precision highp sampler2DArray;
      uniform sampler2DArray diffuseArray;
      uniform sampler2DArray normalArray;
      uniform sampler2D weights;
      uniform sampler2D indexes;
      uniform sampler2D[2] splats;
      uniform sampler2D uNoise;
      uniform sampler2D displacementMap;
      uniform vec2 displacementSize;
      uniform float displacementScale;
      uniform int surfaceSamples;
      uniform float[SURFACES] surfaceNormalStrength;
      uniform float[SURFACES] surfaceNormalY;
      uniform float[SURFACES] surfaceRepeat;
      uniform bool[SURFACES] surfaceGridless;
      uniform bool[SURFACES] surfaceTriplanar;
      uniform vec4[SURFACES] surfaceTint;
      uniform float[SURFACES] surfaceSaturation;
      varying float vZ;
      varying vec3 vHeightNormal;
      // renders diffuse or normal map to a texture
      uniform bool diffuseMode;
      uniform bool normalMode;
      uniform sampler2D distanceDiffuseMap;
      uniform sampler2D distanceNormalMap;
      uniform sampler2D macroMap;
      uniform bool useMacro;
      uniform bool distanceOptimizedRendering;
      uniform float distant;
      
      vec4 csm_NormalMap;
    
      ${normalFunctions}
      ${colorFunctions}
      ${glslNoise}
      // float sum( vec3 v ) { return v.x+v.y+v.z; }

      ${mixers}
      ${samplers}
      ${aperiodic}
      ${triplanar}
      ${biplanar}
      
      
      void main(){        
        ${ 
          props.precalculateWeights ? glsl`
            // can look pixelated when close to camera, may be able to achieve similar results with blur or interpolation.
            vec2[4] surfaces = vec2[4](
              vec2(texture(indexes, vUv).r, texture(weights, vUv).r),
              vec2(texture(indexes, vUv).g, texture(weights, vUv).g),
              vec2(texture(indexes, vUv).b, texture(weights, vUv).b),
              vec2(texture(indexes, vUv).a, texture(weights, vUv).a)
            );
          ` : glsl`
            // sorted splat version (interpolates and sorts)
            // 2 samples and some math to get the index and weight
            vec2[${props.splats.length * 4}] surfaces = vec2[${props.splats.length * 4}](
              ${Array(props.splats.length)
                .fill(0)
                .map((v, i) => {
                  const index = i.toString();
                  return glsl`
                  vec2(${((i * 4 + 0) / 8.0).toString()}, texture2D(splats[${index}], vUv).r),
                  vec2(${(i * 4 + 1)/ 8.0}, texture2D(splats[${index}], vUv).g),
                  vec2(${(i * 4 + 2)/ 8.0}, texture2D(splats[${index}], vUv).b),
                  vec2(${(i * 4 + 3)/ 8.0}, texture2D(splats[${index}], vUv).a)`;
                  })
                .join(",")}
            );
            ${sort("surfaces")}
          `
        }
        
        // manually normalize weights
        float weightSum = 0.0;
        float[SURFACES] weights;
        for(int i = 0; i < surfaceSamples; i++) weightSum += surfaces[i].y;
        
        float Z = texture(displacementMap, vUv).r;
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        // sample variation pattern, used for Aperiodic tiling
        // float k = texture( uNoise, 0.005*uv.xy ).x; // cheap (cache friendly) lookup
        float k = noise(vec3(vUv.xy*200.0, vZ)); // slower but may need to do it if at texture limit

        csm_DiffuseColor = vec4(0,0,0,0);
        csm_NormalMap = texture(normalMap, vUv);
        // reference precalculated maps for distant texels
        vec4 distantNormal = texture(distanceNormalMap, vUv);
        vec4 distantDiffuse = texture(distanceDiffuseMap, vUv);
        vec4 macro = texture(macroMap, vUv);

        // sample a precomputed texture
        if(depth > distant && distanceOptimizedRendering){
          csm_DiffuseColor = distantDiffuse;
          csm_NormalMap = distantNormal;
        }
        else {
          for(int i = 0; i < surfaceSamples; i++){
            int index = int(surfaces[i].x * 8.0);
            float N = surfaceNormalY[index];
            float R = surfaceRepeat[index];
            float P = surfaceNormalStrength[index];
            bool gridless = surfaceGridless[index];
            bool triplanar = surfaceTriplanar[index];
            
            weights[i] = surfaces[i].y / weightSum;
  
            vec4 diffuse;
            vec4 normal;
            // because the branch is based on a static uniform instead of a dynamic value, the compiler can optimize it out
            if(gridless){
              if(triplanar){
                diffuse = TriplanarAperiodicLinearSample(diffuseArray, vec4(vUv, vZ, surfaces[i].x * 8.0), R * vec2(1,N), k);
                normal = TriplanarAperiodicNormalSample(normalArray, vec4(vUv, vZ, surfaces[i].x * 8.0), R * vec2(1,N), k);
              } else {
                diffuse = AperiodicLinearSample(diffuseArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
                normal = AperiodicNormalSample(normalArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
              }
            } else {
              if(triplanar){
                diffuse = TriplanarLinearSample(diffuseArray, vec4(vUv, vZ, surfaces[i].x * 8.0), R * vec2(1,N), k);
                normal = TriplanarNormalSample(normalArray, vec4(vUv, vZ, surfaces[i].x * 8.0), R * vec2(1,N), k);
              }else{
                diffuse = LinearSample(diffuseArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
                normal = NormalSample(normalArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N), k);
              }
            }
  
            // apply saturation and tint
            diffuse = saturation(diffuse, surfaceSaturation[index]);
            diffuse = diffuse * surfaceTint[index];
            
            vec4 weightedDiffuse = diffuse * surfaces[i].y;
            csm_DiffuseColor += weightedDiffuse;
            
            vec4 weightedNormal = slerp(zeroN, normal, weights[i] * P);
            csm_NormalMap = blend_rnm(csm_NormalMap, weightedNormal);
          }


          if(distanceOptimizedRendering){
            float v = pow((depth) / distant, 15.0);
            csm_DiffuseColor = mix(csm_DiffuseColor, distantDiffuse, v);
            csm_NormalMap = mix(csm_NormalMap, distantNormal, v);
          }
        }

        if(useMacro){
          csm_DiffuseColor = saturation(csm_DiffuseColor, macro.w);
          csm_DiffuseColor = csm_DiffuseColor * vec4(macro.xyz, 1.0);
        }

        #ifdef USE_TEST
          csm_DiffuseColor = vec4(1,0,0,1);
        #endif
      
      }
      
    `;

    //@ts-ignore
    super({
      ...props,
      baseMaterial: MeshStandardMaterial,
      uniforms,
      vertexShader,
      fragmentShader,
      patchMap: {
        csm_NormalMap: props.normalMap ? {
          "#include <normal_fragment_maps>": glsl`
            #ifdef OBJECTSPACE_NORMALMAP
              normal = csm_NormalMap.xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
              #ifdef FLIP_SIDED
                normal = - normal;
              #endif
              #ifdef DOUBLE_SIDED
                normal = normal * faceDirection;
              #endif
              normal = normalize( normalMatrix * normal );
              #elif defined( TANGENTSPACE_NORMALMAP )
                vec3 mapN = csm_NormalMap.xyz * 2.0 - 1.0;
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
      }
    });

    this.props = props;
    this.diffuseArray = diffuseArray;
    this.normalArray = normalArray;
    this.renderer = renderer;
    this.context = renderer.getContext();

    if(props.distanceOptimizedRendering) this.initializeDistanceMaps();
    if(props.useMacro && props.macroMap) this.initializeMacroMaps();

    this.defines = {
      "USE_TEST": props.useMacro,
    }
  }

  // @ts-ignore
  set surfaces(surfaces: Surface[]) {
    this.uniforms.surfaceNormalStrength.value = surfaces.map(s => s.normalStrength);
    this.uniforms.surfaceNormalY.value = surfaces.map(s => s.normalY || 1);
    this.uniforms.surfaceRepeat.value = surfaces.map(s => s.repeat || 1);
    this.uniforms.surfaceGridless.value = surfaces.map(s => s.gridless || false);
    this.uniforms.surfaceTriplanar.value = surfaces.map(s => s.triplanar || false);
    this.uniforms.surfaceTint.value = surfaces.map(s => s.tint || new Vector4(1, 1, 1, 1))
    this.uniforms.surfaceSaturation.value = surfaces.map(s => s.saturation || 0.5);

    if(this.props.distanceOptimizedRendering && !this.distanceMaterial) this.initializeDistanceMaps();
    if(this.props.useMacro && this.props.macroMap && !this.macroMaterial) this.initializeMacroMaps();
    
    if(this.props.distanceOptimizedRendering) this.generateDistanceMaps(this.props, this.renderer);    
    if(this.props.useMacro && this.props.macroMap) this.generateMacroMap(this.props, this.renderer);
  
    // todo: figure out why i cant change textures after they are initialized
    // const {diffuseArray, normalArray} = TerrainMaterial.preprocessSurfaces(this.props.surfaces, false);
    // this.uniforms.diffuseArray.value = diffuseArray;
    // this.uniforms.normalArray.value = normalArray;

    this.needsUpdate = true;
    this.props.surfaces = surfaces;
  }

  // @ts-ignore
  // set surfaceSamples(value: number){
  //   this.uniforms.surfaceSamples.value = value ?? 4.0;
  //   // const {weights, indexes} = TerrainMaterial.preprocessSplats(this.props, this.renderer, false);
  //   // this.uniforms.weights = {value: weights};
  //   // this.uniforms.indexes = {value: indexes};
  //   // console.log('hey')
  //   this.needsUpdate = true;
  //   this.props.surfaceSamples = value ?? 4.0;
  // }


  // @ts-ignore
  set smoothness(value : number){
    this.uniforms.smoothness.value = value || 0.1;
    this.needsUpdate = true;
    this.props.smoothness = value;
  }

  // @ts-ignore
  set useMacro(value: boolean){
    this.uniforms.useMacro.value = value;
    this.needsUpdate = true;
    this.props.useMacro = value;
    if(value){
      this.defines.USE_TEST = "";
    } else {
      delete this.defines.USE_TEST;
    }
  }

   // @ts-ignore
  set distanceOptimizedRendering(value: boolean){
    this.uniforms.distanceOptimizedRendering.value = value;
    this.needsUpdate = true;
    this.props.distanceOptimizedRendering = value;
  }

  // @ts-ignore
  set anisotropy(value: number | 'max') {
    let anisotropy = value === 'max' ?  this.getMaxAnisotropy() : value || 1
    const textures = [this.normalArray, this.diffuseArray]
    textures.forEach(t => {
      t.anisotropy = anisotropy;
      t.needsUpdate = true;
    })
    this.needsUpdate = true;
    this.props.anisotropy = value;
  }

  // @ts-ignore
  set generateMipmaps(value: boolean){
    const textures = [this.normalArray, this.diffuseArray]
    textures.forEach(t => {
      t.generateMipmaps = value;
      t.needsUpdate = true;
    })
  }
  // @ts-ignore
  set rotation(value: number){
    const textures = [this.normalArray, this.diffuseArray]
    textures.forEach(t => {
      t.rotation = value;
      t.needsUpdate = true;
    })
  }

  renderTexture(renderer, target, scene, camera) {
    target.texture.needsUpdate = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  initializeMacroMaps() {
    console.log("init macro");
    this.macroMaterial = MacroMaterial(this);
    const {camera, scene} = materialScene(this.macroMaterial);
    this.macroCamera = camera;
    this.macroScene = scene;
    const maxSize = this.getMaxTextureSize();
    let {width, height} = {width:maxSize/4.0, height:maxSize/ 4.0};
    this.macroTarget = new WebGLRenderTarget(width, height, {depthBuffer: false, generateMipmaps: true});
  }

  initializeDistanceMaps() {
    console.log("init distance");
    this.distanceMaterial = DistanceMaterial(this);
    const {camera, scene} = materialScene(this.distanceMaterial);
    this.distanceCamera = camera;
    this.distanceScene = scene;
    const maxSize = this.getMaxTextureSize();
    let {width, height} = {width:maxSize/4.0 , height:maxSize/4.0 };
    this.distanceDiffuseTarget = new WebGLRenderTarget(width, height, {depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter});
    this.distanceNormalTarget = new WebGLRenderTarget(width, height, {depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter});
  }

  getMaxTextureSize(context?){
    const ctx = context ?? this.context;
    return ctx.getParameter(ctx.MAX_TEXTURE_SIZE);
  }

  getMaxAnisotropy(renderer?){
    return (renderer ?? this.renderer).capabilities.getMaxAnisotropy();
  }


  generateMacroMap(props, renderer) {
    const camera = this.macroCamera;
    const scene = this.macroScene;
    const map = this.macroTarget;
    this.renderTexture(renderer, map, scene, camera);
    this.uniforms.macroMap = {value: map.texture};
    this.needsUpdate = true;
  }


  generateDistanceMaps(props, renderer) { 
    const mat = this.distanceMaterial;
    const camera = this.distanceCamera;
    const scene = this.distanceScene;
    const map  = this.distanceDiffuseTarget;
    const normal = this.distanceNormalTarget;
    
    mat.uniforms.diffuseMode.value = 1;
    this.renderTexture(renderer, map, scene, camera);

    mat.uniforms.diffuseMode.value = 0;
    this.renderTexture(renderer, normal, scene, camera);

    this.uniforms.distanceDiffuseMap = {value: map.texture};
    this.uniforms.distanceNormalMap = {value: normal.texture};
    
    this.needsUpdate = true;
  }
   
  // todo: refactor to take a list of textures and an optional cache name?
  // todo: reuse preprocess material, and render targets
  // would be helpful for splats
  static preprocessSplats(props, renderer, useCache = true) {
    const mat  = splatPreProcessMaterial(props.splats, props.surfaceSamples)
    const {camera, scene} = materialScene(mat);
    const ids = props.splats.map((splat) => splat.uuid).join('-');
    
    let weights, indexes;
    const ctx = renderer.getContext();
    const maxSize = ctx.getParameter(ctx.MAX_TEXTURE_SIZE)
    let {width, height} = {width:maxSize, height:maxSize};

    if(props.weights || textureCache[ids] && textureCache[ids].weights){
      weights = props.weights || textureCache[ids].weights;
    } else {      
      weights = new WebGLRenderTarget(width, height, {format: RGBAFormat,stencilBuffer: false});
      weights.texture.minFilter = NearestFilter;
      weights.texture.magFilter = NearestFilter;
      weights.texture.needsUpdate = true;
      renderer.setRenderTarget(weights);
      mat.uniforms.uMode.value = 1; // weights
      renderer.render(scene, camera);
      
      // update splat cache
      if(useCache){
        textureCache[ids] = textureCache[ids] || {};
        textureCache[ids].weights = weights;
      }
    }

    if(props.indexes || textureCache[ids] && textureCache[ids].indexes){
      indexes = props.indexes || textureCache[ids].indexes;
    } else {
      indexes = new WebGLRenderTarget(width, height, {format: RGBAFormat,stencilBuffer: false});
      indexes.texture.minFilter = NearestFilter;
      indexes.texture.magFilter = NearestFilter;
      indexes.texture.needsUpdate = true;
      renderer.setRenderTarget(indexes);
      mat.uniforms.uMode.value = 0; // indexes
      renderer.render(scene, camera);
      
      // update splat cache
      if(useCache){
        textureCache[ids] = textureCache[ids] || {};
        textureCache[ids].indexes = indexes;
      }
    }
    
    renderer.setRenderTarget(null);
    return {weights, indexes};
  }

  // creates textures arrays
  static preprocessSurfaces(surfaces, useCache=true) {
    // create a texture array from the diffuse textures in every surface
    const diffuse = surfaces.map((surface) => surface.diffuse);
    // const displacement = surfaces.map((surface) => surface.displacement);
    const dids = diffuse.map((d) => d.uuid).join('-');
    const diffuseArray = textureCache[dids] || generateTextureArray(diffuse);
    if(useCache) textureCache[dids] = diffuseArray;

    // create a texture array from the normal textures in every surface
    const normals = surfaces.map((surface) => surface.normal);
    const nids = normals.map((n) => n.uuid).join('-');
    const normalArray = textureCache[nids] || generateTextureArray(normals);
    if(useCache) textureCache[nids] = normalArray;

    // console.log(dids, nids);
    

    return {
      diffuseArray,
      normalArray,
    }
  }
}


export default TerrainMaterial;

