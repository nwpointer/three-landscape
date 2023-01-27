import CustomShaderMaterial, { iCSMUpdateParams } from "three-custom-shader-material/vanilla";
import { Texture, Scene, Color, MeshBasicMaterial, LinearFilter, WebGLRenderer, Mesh, PlaneGeometry, OrthographicCamera, WebGLRenderTarget, MeshStandardMaterial, DataArrayTexture, RGBAFormat,UnsignedByteType, LinearMipMapLinearFilter,NearestFilter,RepeatWrapping, sRGBEncoding, LinearMipmapLinearFilter, LinearMipmapNearestFilter } from "three";
import glsl from "glslify";
import { MeshStandardMaterialProps } from "@react-three/fiber";
import { normalFunctions, glslNoise } from "../util/util";
import { triplanar, aperiodic, samplers } from "../util/samplers";
import mixers from "../util/mixers";
import sort from "../util/sort";
import dynamicHeight from "../util/dynamicHeight";
import { splatPreProcessMaterial } from "./splatPreProcessMaterial";

export type Surface = {
  diffuse: THREE.Texture;
  normal?: THREE.Texture;
  normalStrength?: Number;
  normalY?: number;
  repeat?: Number;
  saturation?: Number;
  tint?: THREE.Vector4;
  splatId?: Number;
};

export type TerrainMaterialOptions = MeshStandardMaterialProps & {
  surfaces: Surface[];
  map?: Texture;
  splats: Texture[];
  noise?: Texture;
  displacementMap?: Texture;
  normalMap?: Texture;
  normalScale?: [number, number];
  displacementScale: number;
  anisotropy: number | "max";
  smoothness: number;
  surfaceLimit: number;
};

const textureCache = {};

class TerrainMaterial extends CustomShaderMaterial {
  props: TerrainMaterialOptions;
  renderSplats: Function;
  diffuseArray: DataArrayTexture;
  normalArray: DataArrayTexture;
  renderer: WebGLRenderer;
  
  constructor(props = {} as any, renderer: WebGLRenderer) {
    console.log('TerrainMaterial')
    props.uniforms = props.uniforms || {};

    // todo: remove duplicates
    const {diffuseArray, normalArray} = TerrainMaterial.preprocessSurfaces(props.surfaces, false);
    const {weights, indexes} = TerrainMaterial.preprocessSplats(props, renderer, false);
    const {width, height} = (props.splats[0] || weights.texture).image;

    props.displacementMap.magFilter = LinearFilter;
    props.displacementMap.minFilter = LinearFilter;
    props.displacementMap.needsUpdate = true;
    // console.log(props.displacementMap);
    

    props.uniforms = {
      ...props.uniforms,
      diffuseArray: { value: diffuseArray },
      normalArray: { value: normalArray },
      weights: { value: weights.texture },
      indexes: { value: indexes.texture },
      splats: { value: props.splats },
      displacementMap: { value: props.displacementMap },
      displacementSize: { value: [props.displacementMap.image.width, props.displacementMap.image.height] },
      smoothness: { value: props.smoothness },
      surfaceLimit: { value: props.surfaceLimit },
      surfaceNormalStrength: { value: props.surfaces.map(s => s.normalStrength || 1) },
      surfaceNormalY: { value: props.surfaces.map(s => s.normalY || 1 ) },
      surfaceRepeat: { value: props.surfaces.map(s => s.repeat || 1) },
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
      const int MAX_SURFACES = 8;
      precision highp sampler2DArray;
      uniform sampler2DArray diffuseArray;
      uniform sampler2DArray normalArray;
      uniform sampler2D weights;
      uniform sampler2D indexes;
      uniform sampler2D[2] splats;
      uniform sampler2D displacementMap;
      uniform vec2 displacementSize;
      uniform float displacementScale;
      uniform int surfaceLimit;
      uniform float[MAX_SURFACES] surfaceNormalStrength;
      uniform float[MAX_SURFACES] surfaceNormalY;
      uniform float[MAX_SURFACES] surfaceRepeat;
      varying float vZ;
      varying vec3 vHeightNormal; 
      // vec3 heightNormal;
      
      vec4 csm_NormalMap;
    
      ${normalFunctions}
      ${glslNoise}
      float sum( vec3 v ) { return v.x+v.y+v.z; }

      ${mixers}
      ${samplers}
      ${aperiodic}
      ${triplanar}
      
      
      void main(){
        // Index and weight texture version - this introduces small artifacts so should only be done if needed
        // vec4 i = texture2D(indexes, vUv - mod(vUv, 1.0/(1024.0*16.0)) );
        vec4 i = texture2D(indexes, vUv);
        vec4 w = texture2D(weights, vUv);

        // normalizes the weights
        float surfaceSum = 0.0;
        for(int n = 0; n < surfaceLimit; n++) surfaceSum += w[n];
        for(int n = 0; n < surfaceLimit; n++) w[n] /= surfaceSum;

        //Cached version (sorts and then tries to interpolate)
        csm_DiffuseColor =
          texture(diffuseArray, vec3(vUv*200.0, i.r * 8.0)) * w.r +
          texture(diffuseArray, vec3(vUv*200.0, i.g * 8.0)) * w.g;
          texture(diffuseArray, vec3(vUv*200.0, i.b * 8.0)) * w.b;
          texture(diffuseArray, vec3(vUv*200.0, i.a * 8.0)) * w.a;

        // csm_DiffuseColor = ;


        // // sorted version (interpolates and sorts)f
        // // 2 samples and some math to get the index and weight
        // vec4 t0 = texture2D(splats[0], vUv);
        // vec4 t1 = texture2D(splats[1], vUv);
        // vec2[8] surfaces = vec2[8](
        //   ${Array(2)
        //     .fill(0)
        //     .map((v, i) => {
        //       const index = i.toString();
        //       return glsl`
        //       vec2(${((i * 4 + 0) / 8.0).toString()}, t${index}.r),
        //       vec2(${(i * 4 + 1)/ 8.0}, t${index}.g),
        //       vec2(${(i * 4 + 2)/ 8.0}, t${index}.b),
        //       vec2(${(i * 4 + 3)/ 8.0}, t${index}.a)`;
        //     })
        //     .join(",")}
        // );
        // ${sort("surfaces")}
        // // float surfaceSum = 0.0;
        // // for(int i = 0; i < surfaceLimit; i++) surfaceSum += surfaces[i].y;
        // // for(int i = 0; i < surfaceLimit; i++) surfaces[i].y /= surfaceSum;
        
        // // csm_DiffuseColor = ${generateSamples(props.surfaceLimit)}; 


        // float weightSum = 0.0;
        // float[MAX_SURFACES] weights;
        // float Z = texture(displacementMap, vUv).r;
        // for(int i = 0; i < surfaceLimit; i++) weightSum += surfaces[i].y;
      
        // csm_DiffuseColor = vec4(0,0,0,0);
        // // csm_NormalMap = texture(normalMap, vUv);
        // for(int i = 0; i < surfaceLimit; i++){
        //   int index = int(surfaces[i].x * 8.0);
        //   float N = surfaceNormalY[index];
        //   float R = surfaceRepeat[index];
        //   float P = surfaceNormalStrength[index];
          
        //   weights[i] = surfaces[i].y / weightSum;

        //   // vec4 diffuse = texture(diffuseArray, vec3(vUv*R * vec2(1,N), surfaces[i].x * 8.0));
        //   // vec4 diffuse = AperiodicLinearSample(diffuseArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N));
        //   vec4 diffuse = TriplanarAperiodicLinearSample(diffuseArray, vec4(vUv, vZ, surfaces[i].x * 8.0), R * vec2(1,N));
        //   vec4 weightedDiffuse = diffuse * surfaces[i].y;
        //   csm_DiffuseColor += weightedDiffuse;
          
        //   // vec4 normal = texture(normalArray, vec3(vUv*R * vec2(1.0, N), surfaces[i].x * 8.0));
        //   // vec4 normal = AperiodicNormalSample(normalArray, vec3(vUv, surfaces[i].x * 8.0), R * vec2(1,N));
        //   // vec4 normal = TriplanarAperiodicNormalSample(normalArray, vec4(vUv, vZ, surfaces[i].x * 8.0), R * vec2(1,N));
        //   // vec4 weightedNormal = slerp(zeroN, normal, weights[i] * P);
        //   // csm_NormalMap = blend_rnm(csm_NormalMap, weightedNormal);

        }
      
      }
    `;

    //@ts-ignore
    super({
      ...props,
      baseMaterial: MeshStandardMaterial,
      // patchMap: {
      //   csm_NormalMap: props.normalMap ? {
      //     "#include <normal_fragment_maps>": glsl`
      //       #ifdef OBJECTSPACE_NORMALMAP
      //         normal = csm_NormalMap.xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
      //         #ifdef FLIP_SIDED
      //           normal = - normal;
      //         #endif
      //         #ifdef DOUBLE_SIDED
      //           normal = normal * faceDirection;
      //         #endif
      //         normal = normalize( normalMatrix * normal );
      //         #elif defined( TANGENTSPACE_NORMALMAP )
      //           vec3 mapN = csm_NormalMap.xyz * 2.0 - 1.0;
      //           mapN.xy *= normalScale;
      //           #ifdef USE_TANGENT
      //             normal = normalize( vTBN * mapN );
      //           #else
      //             normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
      //           #endif
      //         #elif defined( USE_BUMPMAP )
      //           normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
      //         #endif
      //     `,
      //   } : {},
      // }
    });

    this.props = props;
    this.diffuseArray = diffuseArray;
    this.normalArray = normalArray;
    this.renderer = renderer;
  }

  // @ts-ignore
  set surfaces(surfaces: Surface[]) {
    this.uniforms.surfaceNormalStrength.value = surfaces.map(s => s.normalStrength);
    this.uniforms.surfaceNormalY.value = surfaces.map(s => s.normalY || 1);
    this.uniforms.surfaceRepeat.value = surfaces.map(s => s.repeat || 1);
    this.needsUpdate = true;
  }

  // @ts-ignore
  set surfaceLimit(value: number){
    this.uniforms.surfaceLimit.value = value;
    // const {weights, indexes} = TerrainMaterial.preprocessSplats(this.props, this.renderer, false);
    // this.uniforms.weights = {value: weights};
    // this.uniforms.indexes = {value: indexes};
    // console.log('hey')
    this.needsUpdate = true;
  }


  // @ts-ignore
  set smoothness(value : number){
    // this.uniforms.displacementMap.value.minFilter = NearestFilter;
    // this.uniforms.displacementMap.value.magFilter = NearestFilter;
    // this.uniforms.displacementMap.value.needsUpdate = true;
    this.uniforms.smoothness.value = value || 0.1;
    this.needsUpdate = true;

  }

  // @ts-ignore
  set anisotropy(value: number | 'max') {
    // todo look up actual max value
    let anisotropy = value === 'max' ?  16 : value || 1
    
    const textures = [this.normalArray, this.diffuseArray]
    textures.forEach(t => {
      t.anisotropy = anisotropy;
      t.needsUpdate = true;
    })
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
   
  // todo: refactor to take a list of textures and an optional cache name?
  // todo: reuse preprocess material, and render targets
  // would be helpful for splats
  static preprocessSplats(props, renderer, useCache = true) {
    const mat  = splatPreProcessMaterial(props.splats, props.surfaceLimit)
    const {camera, scene} = materialScene(mat);
    const ids = props.splats.map((splat) => splat.uuid).join('-');
    
    let weights, indexes;

    let {width, height} = props.splats[0].image;
    // console.log(width, height);
    
    width *= 4.0;
    height *= 4.0;
    if(props.weights || textureCache[ids] && textureCache[ids].weights){
      weights = props.weights || textureCache[ids].weights;
    } else {      
      weights = new WebGLRenderTarget(width, height, {format: RGBAFormat,stencilBuffer: false});
      // weights.texture.minFilter = NearestFilter;
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
      // indexes.texture.minFilter = NearestFilter;
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



// Brute force version
// vec4 splat1 = texture2D(splats[0], vUv);
// vec4 splat2 = texture2D(splats[1], vUv);
// csm_DiffuseColor =
//   texture(diffuseArray, vec3(vUv * 200.0, 0.0)) * splat1.r +
//   texture(diffuseArray, vec3(vUv * 200.0, 1.0)) * splat1.g +
//   texture(diffuseArray, vec3(vUv * 200.0, 2.0)) * splat1.b +
//   texture(diffuseArray, vec3(vUv * 200.0, 3.0)) * splat1.a +
//   texture(diffuseArray, vec3(vUv * 200.0, 4.0)) * splat2.r +
//   texture(diffuseArray, vec3(vUv * 200.0, 5.0)) * splat2.g +
//   texture(diffuseArray, vec3(vUv * 200.0, 6.0)) * splat2.b;


// Index and weight texture version - this introduces small artifacts so should only be done if needed
// vec4 i = texture2D(indexes, vUv - mod(vUv, 1.0/(1024.0*16.0)) );
// vec4 i = texture2D(indexes, vUv );
// vec4 w = texture2D(weights, vUv);

// Cached version (sorts and then tries to interpolate)
// csm_DiffuseColor = 
//   texture(diffuseArray, vec3(vUv*200.0, i.r * 8.0)) * w.r;
//   texture(diffuseArray, vec3(vUv*200.0, i.g * 8.0)) * w.g;
//   texture(diffuseArray, vec3(vUv*200.0, i.b * 8.0)) * w.b;
//   texture(diffuseArray, vec3(vUv*200.0, i.a * 8.0)) * w.a;