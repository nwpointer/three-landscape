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
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      wireframe={props.wireframe}
      map={props.map}
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

        void main(){
          csm_DiffuseColor = normalize(${computeDiffuse(
            props.materials,
            props.splatMode
          )});
        }
      `}
    />
  );
}

const repeatTexture = (t) => {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
};

function computeDiffuse(materials, splatMode = "bw") {
  if (splatMode === "bw") {
    const r1 = materials[0].repeat || 1;
    const r2 = materials[1].repeat || 1;
    return `mix(
      texture2D(uDiffuse[0], vUv * vec2(${r1},${r1})),
      texture2D(uDiffuse[1], vUv * vec2(${r2},${r2})),
      texture2D(uSplats[0], vUv).r
    )`;
  }

  let d = 0;
  return materials
    .map((material, m) => {
      if (material.diffuse) {
        const r = material.repeat || 1;
        const colorValue = `texture2D(uDiffuse[${d}], vUv * vec2(${r}, ${r}))`;
        const index = splatIndex(m, splatMode);
        const channel = splatChannel(m, splatMode);
        let weight = `texture2D(uSplats[${index}], vUv).${channel}`;
        d++;
        return `${colorValue} * ${weight}`;
      }
    })
    .filter((v) => v)
    .join(" + ");
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
