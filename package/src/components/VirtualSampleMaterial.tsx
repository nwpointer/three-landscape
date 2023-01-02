import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Texture } from "three";
import { MeshStandardMaterial} from "three";
import glsl from "glslify";

import { MeshStandardMaterialProps } from "@react-three/fiber";

// map 
export default function VirtualSampleMaterial(props: MeshStandardMaterialProps & {pageTable: Texture}) {
  return (
    
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      {...props}
      uniforms={{
        uPageTable: {value: [props.pageTable]}
      }}
      vertexShader={glsl`
        varying vec4 csm_vWorldPosition;
        void main(){

        }
      `}
      fragmentShader={glsl`
        varying vec4 csm_vWorldPosition;
        uniform sampler2D displacementMap;
        uniform sampler2D uPageTable;

        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float offset  = texture2D(uPageTable, vUv).r;
          csm_DiffuseColor = texture2D(uPageTable, vUv);
        }
      `}
    />
  );
}