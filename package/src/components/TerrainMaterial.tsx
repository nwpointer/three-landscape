import React from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { MeshStandardMaterial, Texture } from "three";
import glsl from "glslify";

export type splatMaterial = {
  diffuse: Texture;
  normal?: Texture;
};

export default function TerrainMaterial(props: {
  wireframe?: boolean;
  materials: splatMaterial[];
  map?: Texture;
  splats: Texture[];
}) {
  const diffuse = props.materials.map((v) => v.diffuse);
  const normal = props.materials.map((v) => v.normal);
  return (
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      wireframe={props.wireframe}
      map={props.map}
      uniforms={{
        uSplats: { value: props.splats },
        uDiffuse: { value: diffuse },
        uNormal: { value: normal },
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

        void main(){
          vec4 d1 = texture2D(uDiffuse[0], vUv);
          vec4 d2 = texture2D(uDiffuse[1], vUv);
          float alpha =  texture2D(uSplats[0], vUv).r;
          csm_DiffuseColor = mix(d1, d2, alpha);
        }
      `}
    />
  );
}
