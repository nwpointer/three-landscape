import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture } from "three";
import glsl from "glslify";

export type splatMaterial = {
  diffuse?: Texture;
  normal?: Texture;
  repeat?: Number;
};

export default function TerrainMaterial(props: {
  wireframe?: boolean;
  materials: splatMaterial[];
  map?: Texture;
  splats: Texture[];
  splatMode?: "bw" | "rgb" | "rgba";
}) {
  const diffuse = props.materials.map((v) => v.diffuse).filter((v) => v);
  const normal = props.materials.map((v) => v.normal).filter((v) => v);
  const repeat = props.materials.map((v) => v.repeat || 1);
  const textures = [...props.splats, ...diffuse, ...normal].filter((v) => v);
  textures.map(repeatTexture);

  if (props.materials.length > 2 && props.splatMode === "bw")
    throw Error("use rgb or rgba textures if you have more than 2 materials");

  return (
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      wireframe={props.wireframe}
      map={diffuse[0]}
      normalMap={normal[0]}
      // metalness={0.5}
      roughness={0.5}
      uniforms={{
        uSplats: { value: props.splats },
        uDiffuse: { value: diffuse },
        uNormal: { value: normal },
        uRepeat: { value: repeat },
      }}
      fragmentShader={glsl`
        precision mediump float;
        #pragma vscode_glsllint_stage : frag
        #ifndef csm_DiffuseColor
          vec4 csm_DiffuseColor = vec4(0,0,0,0);
        #endif

        uniform sampler2D uSplats[${props.splats.length}];
        uniform sampler2D uDiffuse[${diffuse.length}];
        uniform sampler2D uNormal[${normal.length}];
        uniform float uRepeat[${repeat.length}];
        vec4 zeroN = vec4(0.5, 0.5, 1, 1);
        vec3 csm_NormalMap;

        // utility function
        vec4 blend_rnm(vec4 n1, vec4 n2){
          vec3 t = n1.xyz*vec3( 2,  2, 2) + vec3(-1, -1,  0);
          vec3 u = n2.xyz*vec3(-2, -2, 2) + vec3( 1,  1, -1);
          vec3 r = t*dot(t, u) /t.z -u;
          return vec4((r), 1.0) * 0.5 + 0.5;
        }
        
        void main(){
          // normalize insures all pixels are at full strength and not mixed with black
          csm_DiffuseColor = normalize(${computeDiffuse(
            props.materials,
            props.splatMode
          )});

          // csm_NormalMap = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
          csm_NormalMap = ${computeNormal(
            props.materials,
            props.splatMode
          )}.rgb * 2.0 - 1.0;
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
      }}
    />
  );
}

// csm_DiffuseColor = ${computeNormal(
//   props.materials,
//   props.splatMode
// )} * 2.0 - 1.0;

const repeatTexture = (t) => {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
};

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
  const r = material.repeat || 1;
  return `texture2D(${textureArrayName}[${i}], vUv * vec2(${r}, ${r}))`;
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
