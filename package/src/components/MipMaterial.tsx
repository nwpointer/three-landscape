import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { MeshStandardMaterial} from "three";
import glsl from "glslify";

import { MeshStandardMaterialProps } from "@react-three/fiber";

export default function MipMaterial(props: MeshStandardMaterialProps) {
  return (
    
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      {...props}
      uniforms={{
        uTextures: {value: [props.displacementMap]}
      }}
      vertexShader={glsl`
        varying vec4 csm_vWorldPosition;
        void main(){

        }
      `}
      fragmentShader={glsl`
        varying vec4 csm_vWorldPosition;
        uniform sampler2D displacementMap;
        uniform sampler2D[2] uTextures;

        const float vt_page_size = 128.0;
        const float vt_size = 32768.0;
        float mipmapLevel(vec2 uv, float textureSize)  {
            vec2 dx = dFdx(uv * textureSize);
            vec2 dy = dFdy(uv * textureSize);
            float d = max(dot(dx, dx), dot(dy, dy));
            return 0.5 * log2(d);
        }

        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          // csm_DiffuseColor = texture2D(uTextures[0], vUv);
          float v = mipmapLevel(vUv, vt_size);
          csm_DiffuseColor = vec4(floor(vUv * vt_page_size) / 255.0, floor(v), 1.0);
        }
      `}
    />
  );
}