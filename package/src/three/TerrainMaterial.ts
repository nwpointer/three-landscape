import CustomShaderMaterial, { iCSMUpdateParams } from "three-custom-shader-material/vanilla";
import { Texture, Scene, Color, MeshBasicMaterial, LinearFilter, WebGLRenderer, Mesh, PlaneGeometry, OrthographicCamera, WebGLRenderTarget, MeshStandardMaterial, DataArrayTexture, RGBAFormat,UnsignedByteType, LinearMipMapLinearFilter,NearestFilter,RepeatWrapping, sRGBEncoding, LinearMipmapLinearFilter, LinearMipmapNearestFilter, Vector4 } from "three";
import glsl from "glslify";
import { MeshStandardMaterialProps } from "@react-three/fiber";
import { normalFunctions, colorFunctions, glslNoise } from "../util/util";
import { triplanar, biplanar, aperiodic, samplers } from "../util/samplers";
import mixers from "../util/mixers";
import sort from "../util/sort";
import dynamicHeight from "../util/dynamicHeight";
import { splatPreProcessMaterial } from "./splatPreProcessMaterial";
import noise from "../util/noise";
import { ShaderMaterial } from "three";

export type Surface = {
  diffuse: THREE.Texture;
  normal?: THREE.Texture;
  normalStrength?: Number;
  normalY?: number;
  repeat?: Number;
  saturation?: Number;
  tint?: THREE.Vector4;
  splatId?: Number;
  triplanar?: boolean;
  gridless?: boolean;
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
  activeSurfaces?: number;
  macroMap?: Texture;
  useMacro?: boolean;
  useDistanceOptimizedRendering?: boolean;
  usePrecalculatedWeights?: boolean;
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
    const {weights, indexes} = props.usePrecalculatedWeights ? TerrainMaterial.preprocessSplats(props, renderer, false) : {weights: null, indexes: null};
    
    props.uniforms = {
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
      activeSurfaces: { value: props.activeSurfaces ?? 4.0 },
      surfaceNormalStrength: { value: props.surfaces.map(s => s.normalStrength || 1) },
      surfaceNormalY: { value: props.surfaces.map(s => s.normalY || 1 ) },
      surfaceRepeat: { value: props.surfaces.map(s => s.repeat || 1) },
      surfaceGridless: { value: props.surfaces.map(s => s.gridless || false) },
      surfaceTriplanar: { value: props.surfaces.map(s => s.triplanar || false) },
      surfaceTint: { value: props.surfaces.map(s => s.tint || new Vector4(1, 1, 1, 1)) },
      surfaceSaturation: { value: props.surfaces.map(s => s.saturation || 0.5) },
      distanceDiffuseMap: { value: undefined },
      distanceNormalMap: { value: undefined },
      macroMap: { value: undefined },
      diffuseMode: { value: false },
      normalMode: { value: false },
      useMacro: { value: false },
      useDistanceOptimizedRendering: { value: props.useDistanceOptimizedRendering },
      distant: { value: 150.0 },
    };

    props.vertexShader = glsl`
      uniform float smoothness;
      uniform vec2 displacementSize;
      varying float vZ;
      varying vec3 vHeightNormal;

      ${dynamicHeight}

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

    props.fragmentShader = glsl`
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
      uniform int activeSurfaces;
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
      uniform bool useDistanceOptimizedRendering;
      uniform float distant;
      
      vec4 csm_NormalMap;
    
      ${normalFunctions}
      ${colorFunctions}
      ${glslNoise}
      float sum( vec3 v ) { return v.x+v.y+v.z; }

      ${mixers}
      ${samplers}
      ${aperiodic}
      ${triplanar}
      ${biplanar}
      
      
      void main(){        
        ${ 
          props.usePrecalculatedWeights ? glsl`
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
        for(int i = 0; i < activeSurfaces; i++) weightSum += surfaces[i].y;
        
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
        if(depth > distant && useDistanceOptimizedRendering){
          csm_DiffuseColor = distantDiffuse;
          csm_NormalMap = distantNormal;
        }
        else {
          for(int i = 0; i < activeSurfaces; i++){
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


          if(useDistanceOptimizedRendering){
            float v = pow((depth) / distant, 15.0);
            csm_DiffuseColor = mix(csm_DiffuseColor, distantDiffuse, v);
            csm_NormalMap = mix(csm_NormalMap, distantNormal, v);
          }
        }

        if(useMacro){
          csm_DiffuseColor = saturation(csm_DiffuseColor, macro.w);
          csm_DiffuseColor = csm_DiffuseColor * vec4(macro.xyz, 1.0);
        }
      
      }
      
    `;

    //@ts-ignore
    super({
      ...props,
      baseMaterial: MeshStandardMaterial,
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

    if(props.useDistanceOptimizedRendering) this.initializeDistanceMaps();
    if(props.useMacro && props.macroMap) this.initializeMacroMaps();
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

    if(this.props.useDistanceOptimizedRendering && !this.distanceMaterial) this.initializeDistanceMaps();
    if(this.props.useMacro && this.props.macroMap && !this.macroMaterial) this.initializeMacroMaps();
    
    if(this.props.useDistanceOptimizedRendering) this.generateDistanceMaps(this.props, this.renderer);    
    if(this.props.useMacro && this.props.macroMap) this.generateMacroMap(this.props, this.renderer);
  
    // todo: figure out why i cant change textures after they are initialized
    // const {diffuseArray, normalArray} = TerrainMaterial.preprocessSurfaces(this.props.surfaces, false);
    // this.uniforms.diffuseArray.value = diffuseArray;
    // this.uniforms.normalArray.value = normalArray;

    this.needsUpdate = true;
    this.props.surfaces = surfaces;
  }

  // @ts-ignore
  set activeSurfaces(value: number){
    this.uniforms.activeSurfaces.value = value ?? 4.0;
    // const {weights, indexes} = TerrainMaterial.preprocessSplats(this.props, this.renderer, false);
    // this.uniforms.weights = {value: weights};
    // this.uniforms.indexes = {value: indexes};
    // console.log('hey')
    this.needsUpdate = true;
    this.props.activeSurfaces = value ?? 4.0;
  }


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
  }

   // @ts-ignore
  set useDistanceOptimizedRendering(value: boolean){
    this.uniforms.useDistanceOptimizedRendering.value = value;
    this.needsUpdate = true;
    this.props.useDistanceOptimizedRendering = value;
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

  getMaxTextureSize(context){
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
    const mat  = splatPreProcessMaterial(props.splats, props.activeSurfaces)
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

// assumes textures are loaded and ready to go.
// would be better to generate as the textures load
function generateTextureArray(textures) {
  const { width, height } = textures[0].image;
  const texturesData = new Uint8Array(width * height * 4 * textures.length);

  // for each texture in the textures array
  textures.forEach((texture, i) => {
    const data = getImageData(texture.image).data;
    const offset = i * width * height * 4;
    texturesData.set(data, offset);
  });

  const textureArray = new DataArrayTexture(
    texturesData,
    width,
    height,
    textures.length
  );
  
  // set the mips and such
  textureArray.needsUpdate = true;
  textureArray.format = RGBAFormat;
  textureArray.encoding = sRGBEncoding;
  textureArray.type = UnsignedByteType;
  textureArray.minFilter = LinearMipMapLinearFilter;
  textureArray.magFilter = NearestFilter;
  textureArray.wrapS = RepeatWrapping;
  textureArray.wrapT = RepeatWrapping;
  textureArray.generateMipmaps = true;

  return textureArray;
}

function getImageData(image) {
  // todo: investigate offscreen canvas, or renderBuffers
  var canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  var context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  return context.getImageData(0, 0, image.width, image.height);
}

function materialScene(mat){
  const camera = new OrthographicCamera(-0.5, 0.5, -0.5, 0.5, 1, 10);
  const scene = new Scene();
  const geo = new PlaneGeometry(1, 1);
  const mesh = new Mesh(geo, mat);
  mesh.rotation.set(-Math.PI, 0, 0);
  camera.position.set(0, 0, 1);
  scene.add(mesh);

  return {camera, scene}
}


function generateSamples(sampleCount=4){
  return Array(sampleCount).fill(0).map((v, i) => {
    const index = i.toString();
    // x is the index, y is the weight
    return glsl`texture(diffuseArray, vec3(vUv*200.0, surfaces[${index}].x * 8.0)) * surfaces[${index}].y`;
  }).join(" + \n")
}

function MacroMaterial(parent) {
  parent.props.macroMap.wrapT = RepeatWrapping;
  parent.props.macroMap.wrapS = RepeatWrapping;
  parent.props.macroMap.needsUpdate = true;
  return new ShaderMaterial({
    uniforms: {
      variationMap: { value: parent.props.macroMap },
    },
    vertexShader: glsl`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: glsl`
      precision highp float;
      uniform sampler2D variationMap;
      varying vec2 vUv;
      void main() {
        gl_FragColor = 
        texture2D(variationMap, vUv/ 4.0) / 3.0 + 1.4 -
        texture2D(variationMap, vUv*4.0);
        
        gl_FragColor.w = 0.5;
        gl_FragColor.w = max(0.5, (texture2D(variationMap, vUv*8.0).r / 1.5 + texture2D(variationMap, vUv).r / 1.5)/2.0);
      }
    `
  });
}

// simplified version of the shader that calculates the distant diffuse and normal maps
function DistanceMaterial(parent) {
  return new ShaderMaterial({
    uniforms :{
      ...parent.uniforms,
      diffuseMode: { value: true },
      normalMap: { value: parent.normalMap },
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
        uniform int activeSurfaces;
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
                vec2(${(i * 4 + 1)/ 8.0}, t${index}.g),
                vec2(${(i * 4 + 2)/ 8.0}, t${index}.b),
                vec2(${(i * 4 + 3)/ 8.0}, t${index}.a)`;
              })
              .join(",")}
          );
          ${sort("surfaces")}

          float[SURFACES] weights;
          float Z = 0.0; // fix this
          float weightSum = 0.0;
          for(int i = 0; i < activeSurfaces; i++) weightSum += surfaces[i].y;

          int index = int(surfaces[0].x * 8.0);
          float R = surfaceRepeat[index];
          float N = surfaceNormalY[index];

          float k = noise(vec3(vUv.xy*200.0, 0.0)); // slower but may need to do it if at texture limit

          if(diffuseMode){
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            for(int i = 0; i < activeSurfaces; i++){
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
            for(int i = 0; i < activeSurfaces; i++){
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
      `,
  });
}