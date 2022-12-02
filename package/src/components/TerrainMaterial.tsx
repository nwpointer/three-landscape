import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture } from "three";
import glsl from "glslify";
import noise from "./noise";

//github.com/simondevyoutube/Quick_3D_MMORPG/blob/547884332ca650abe96264f7230702d36481b9bc/client/src/terrain-shader.js

// substance instead of material?
export type splatMaterial = {
  diffuse?: Texture;
  normal?: Texture;
  repeat?: Number;
};

function getDimensions(texture) {
  return {
    width: texture.source.data.width,
    height: texture.source.data.height,
  };
}

const map = f => arr => arr.map(f);
const filter = f => arr => arr.filter(f);
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const pluck = key => map(v=>v[key])
const defined = filter(v=>v);
const standard = defaultValue => map(v=>v||defaultValue);
const repeatTexture = (t) => {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
}

const repeatTextures = map(repeatTexture);
const option = (arr, key, defaultValue?) => pipe(
  pluck(key),
  standard(defaultValue),
  defined,
)(arr)

export default function TerrainMaterial(props: {
  wireframe?: boolean;
  materials: splatMaterial[];
  map?: Texture;
  splats: Texture[];
  splatMode?: "bw" | "rgb" | "rgba";
  noise?: Texture;
  displacementMap?: Texture;
  normalMap?: Texture;
  displacementScale: Number;
}) {
  const diffuse = option(props.materials, 'diffuse')
  const normal = option(props.materials, 'normal')
  const repeat = option(props.materials, 'repeat', 1)
  const textures = defined([...props.splats, ...diffuse, ...normal, noise])
  
  // apply repetition option to all textures
  repeatTextures(textures)
  
  if (props.materials.length > 2 && props.splatMode === "bw")
    throw Error("use rgb or rgba textures if you have more than 2 materials");

  const displacementSize = getDimensions(props.displacementMap);
  if (displacementSize.width != displacementSize.height) {
    throw Error("please use square displacement maps");
  }
  const dw = displacementSize.width.toFixed(20);
  const dh = displacementSize.height.toFixed(20);

  return (
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      wireframe={props.wireframe}
      map={diffuse[0]}
      // metalness={0.5}
      // roughness={0.5}
      displacementMap={props.displacementMap}
      normalMap={props.normalMap}
      displacementScale={props.displacementScale}
      uniforms={{
        uNoise: { value: props.noise || noise },
        uSplats: { value: props.splats },
        uDiffuse: { value: diffuse },
        uNormal: { value: normal },
        uRepeat: { value: repeat },
      }}
      vertexShader={glsl`
        varying vec3 csm_vWorldPosition;
        varying vec3 csm_vNormal;
        float csm_Displacement;

        float biLerp(float a, float b, float c, float d, float s, float t)
        {
          float x = mix(a, b, t);
          float y = mix(c, d, t);
          return mix(x, y, s);
        }

        void main() {
          // todo: change this from world position + height to uv + height?
          // csm_vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          // vec3 realPosition = position;
          // realPosition.z = texture2D( displacementMap, uv ).x * displacementScale + displacementBias;
          // csm_vWorldPosition = (modelMatrix * vec4(realPosition, 1.0)).xyz;
          csm_vNormal = normal;

          // displaceent
          float tw = 1.0 / ${dw};
          float th = 1.0 / ${dh};
          // float dx = uv.x - (floor(uv.x * ${dw})/${dw});
          // float dy = uv.y - (floor(uv.y * ${dh})/${dh});
          float dx = 0.5;
          float dy = 0.5;
          float a = texture2D( displacementMap, uv ).x;
          float b = texture2D( displacementMap, uv + tw ).x;
          float c = texture2D( displacementMap, uv + th ).x;
          float d = texture2D( displacementMap, uv + tw + th ).x;
          float t = texture2D( displacementMap, uv ).x;
          float l = biLerp(a,b,c,d,dy,dx);
          csm_Displacement = t * displacementScale + displacementBias;
        }
      `}
      fragmentShader={glsl`
        // precision mediump float;
        uniform sampler2D displacementMap;
        uniform float displacementScale;
        uniform sampler2D uNoise;
        uniform sampler2D uSplats[${props.splats.length}];
        uniform sampler2D uDiffuse[${diffuse.length}];
        uniform sampler2D uNormal[${normal.length}];
        uniform float uRepeat[${repeat.length}];
        vec4 zeroN = vec4(0.5, 0.5, 1, 1);
        vec3 csm_NormalMap;

        varying vec3 csm_vWorldPosition;
        varying vec3 csm_vNormal;


        // UTILITY FUNCTIONS ----------------------------------------------------------------------------------------------------
        vec4 blend_rnm(vec4 n1, vec4 n2){
          vec3 t = n1.xyz*vec3( 2,  2, 2) + vec3(-1, -1,  0);
          vec3 u = n2.xyz*vec3(-2, -2, 2) + vec3( 1,  1, -1);
          vec3 r = t*dot(t, u) /t.z -u;
          return vec4((r), 1.0) * 0.5 + 0.5;
        }

        float sum( vec3 v ) { return v.x+v.y+v.z; }
        vec3 pow3(vec3 n, float x){
          return vec3(pow(n.x,x),pow(n.y,x),pow(n.z,x));
        }

        vec3 heightNormal(){
          float o = 8.0/1024.0;
          float h = dot(texture2D(displacementMap, vUv),  vec4(1,0,0,1));
          float hx = dot(texture2D(displacementMap, vUv + vec2( o, 0.0 )), vec4(1,0,0,1));
          float hy = dot(texture2D(displacementMap, vUv + vec2( 0.0, o )),  vec4(1,0,0,1));
          float dScale = 30.0;
          float dx = (hx - h) * dScale;
          float dy = (hy - h) * dScale;
          return (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));
        }

        vec4 stochasticSample( sampler2D samp, vec2 uv ){
          // sample variation pattern
          float k = texture2D( uNoise, 0.005*uv ).x; // cheap (cache friendly) lookup

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

          // // interpolate between the two virtual patterns
          vec3 col = mix( cola, colb, smoothstep(0.2,0.8,f-0.1*sum(cola-colb)) );
          return vec4(col,1.0);
        }

        vec4 triSample(sampler2D map, float scale){
          // vec3 n = (heightNormal()); 
          vec3 n = texture2D( normalMap, vUv ).xyz;
          
          vec3 yDiff = texture2D(map, csm_vWorldPosition.xz * scale).xyz;
			    vec3 xDiff = texture2D(map, csm_vWorldPosition.zy * scale).xyz;
          vec3 zDiff = texture2D(map, csm_vWorldPosition.xy * scale).xyz;

          float sharpness = 20.0;
          vec3 weights = normalize(pow3(n,sharpness));
          vec3 color = (xDiff * weights.x + yDiff * weights.y + zDiff * weights.z);

          return vec4(color,1.0);
        }

        vec4 triSampleStocastic(sampler2D map, float scale){
          // vec3 n = (heightNormal()); 
          vec3 n = texture2D( normalMap, vUv ).xyz;
          
          vec3 yDiff = stochasticSample(map, csm_vWorldPosition.xz * scale).xyz;
			    vec3 xDiff = stochasticSample(map, csm_vWorldPosition.zy * scale).xyz;
          vec3 zDiff = stochasticSample(map, csm_vWorldPosition.xy * scale).xyz;


          float sharpness = 20.0;
          vec3 weights = normalize(pow3(n,sharpness));
          vec3 color = (xDiff * weights.x + yDiff * weights.y + zDiff * weights.z);

          return vec4(color,1.0);
        }

        // FRAGMENT OUT ----------------------------------------------------------------------------------------------------
        void main(){
          // normalize insures all pixels are at full strength and not mixed with black
          csm_DiffuseColor = normalize(${computeDiffuse(
            props.materials,
            props.splatMode
          )});

          csm_NormalMap = normalize(${computeNormal(
            props.materials,
            props.splatMode
          )}.rgb * 2.0 - 1.0);

          // csm_NormalMap = texture2D(normalMap, vUv).xyz;

          // displayment test
          // csm_DiffuseColor = texture2D(displacementMap, vUv);
          // csm_DiffuseColor.x = mod(csm_DiffuseColor.x*80.0, 1.0);
          // csm_DiffuseColor.y = mod(csm_DiffuseColor.y*80.0, 1.0);
          // csm_DiffuseColor.z = mod(csm_DiffuseColor.z*80.0, 1.0);
        }
      `}
      patchMap={{
        csm_NormalMap: {
          "#include <normal_fragment_maps>": glsl`
            vec3 mapN = csm_NormalMap;
            mapN.xy *= normalScale;
            normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
          `,
        },
        csm_Displacement: {
          "#include <displacementmap_vertex>": glsl`
            #ifdef USE_DISPLACEMENTMAP
              transformed += normalize( objectNormal ) * csm_Displacement;
            #endif
          `,
        },
      }}
    />
  );
}



function computeNormal(materials, splatMode) {
  let n = 0;
  return materials.reduce((shader, material, m) => {
    if (material.normal) {
      if (n == 0) shader = "zeroN";
      const color = normalValue(n, material);
      const weight = splatValue(m, splatMode);
      const normalScale = (material.normalScale || 1).toFixed(2);
      const value = `mix(zeroN, ${color}, ${weight} * ${normalScale})`;
      n++;
      return `blend_rnm(
        ${value}, 
        ${shader})
      `;
    }
    return shader;
  }, "");
}

function computeDiffuse(materials, splatMode) {
  let d = 0;
  return materials
    .map((material, m) => {
      if (material.diffuse) {
        const color = diffuseValue(d, material);
        const weight = splatValue(m, splatMode);
        d++;
        return `${color} * ${weight}`;
      }
    })
    .filter((v) => v)
    .join(" + ");
}

const diffuseValue = (i, material) => colorValue(i, material, "diffuse");
const normalValue = (i, material) => colorValue(i, material, "normal");

function colorValue(i, material, type: "diffuse" | "normal") {
  const textureArrayName = type == "diffuse" ? "uDiffuse" : "uNormal";
  let r = (material.repeat || 1).toFixed(20);

  if (material.triplanar) r = (r / 10).toFixed(20);

  if (material.sampler == "tiled") {
    if (material.triplanar) {
      return `triSample(${textureArrayName}[${i}], ${r})`;
    } else {
      return `texture2D(${textureArrayName}[${i}], vUv * vec2(${r}, ${r}))`;
    }
  } else {
    if (material.triplanar) {
      return `triSampleStocastic(${textureArrayName}[${i}], ${r})`;
    } else {
      return `stochasticSample(${textureArrayName}[${i}], vUv * vec2(${r}, ${r}))`;
    }
  }
}

function splatValue(m, splatMode) {
  const index = splatIndex(m, splatMode);
  const channel = splatChannel(m, splatMode);
  return `texture2D(uSplats[${index}], vUv).${channel}`;
}

const splatSize = {
  bw: 2,
  rgb: 3,
  rgba: 4,
};

function splatIndex(i, splatMode) {
  return Math.floor(i / splatSize[splatMode]);
}
function splatChannel(i, splatMode) {
  return ["r", "g", "b", "a"][i % splatSize[splatMode]];
}
