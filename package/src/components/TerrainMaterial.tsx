import React from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { MeshStandardMaterial } from "three";
import glsl from "glslify";

export default function TerrainMaterial({}) {
  return (
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      fragmentShader={glsl`
        precision mediump float;
        #pragma vscode_glsllint_stage : frag
        #ifndef csm_DiffuseColor
          vec4 csm_DiffuseColor = vec4(0,0,0,0);
        #endif
        void main(){
          csm_DiffuseColor = vec4(1,1,0,0);
        }
      `}
    />
  );
}
