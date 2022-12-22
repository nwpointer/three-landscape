import React from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { MeshStandardMaterial, Texture } from "three";
import glsl from "glslify";

import { MeshStandardMaterialProps } from "@react-three/fiber";

export default function BasicMaterial(
  props: MeshStandardMaterialProps & {
    noise?: Texture;
  }
) {
  return (
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      {...props}
      uniforms={{}}
      vertexShader={glsl`
        varying vec3 csm_vWorldPosition;
      `}
      fragmentShader={glsl`
        varying vec3 csm_vWorldPosition;

        const float vt_dimension_pages = 128.0;
        const float vt_dimension = 32768.0;
        float mipmapLevel(vec2 uv, float textureSize)  {
            vec2 dx = dFdx(uv * textureSize);
            vec2 dy = dFdy(uv * textureSize);
            float d = max(dot(dx, dx), dot(dy, dy));
            return 0.5 * log2(d);
        }
        
        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
            float depth = gl_FragCoord.z / gl_FragCoord.w;
            // TODO: IMPROVE:
            csm_DiffuseColor = vec4(
                depth,
                0.0,
                0.0,
                1.0
            );
        }
      `}
    />
  );
}
