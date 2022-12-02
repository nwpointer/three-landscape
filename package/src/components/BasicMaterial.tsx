import React, { useMemo } from "react";
import CustomShaderMaterial from "three-custom-shader-material";
import { Material, MeshStandardMaterial, RepeatWrapping, Texture } from "three";
import glsl from "glslify";
import noise from "./noise";
import { option, repeatTextures, defined, pixelateTextures,glslNoise, paralax  } from './util.js'

// substance instead of material?
export type splatMaterial = {
  diffuse?: Texture;
  normal?: Texture;
  repeat?: Number;
};

export default function TerrainMaterial(props: {
  wireframe?: boolean;
  materials: splatMaterial[];
  map?: Texture;
  noise?: Texture;
  displacementMap?: Texture;
  normalMap?: Texture;
  displacementScale?: Number;
}) {
  const diffuse = option(props.materials, 'diffuse')
  const normal = option(props.materials, 'normal')
  const height = option(props.materials, 'height')
  const repeat = option(props.materials, 'repeat', 1)
  const textures = defined([...diffuse, ...normal, ...height, noise])
  
  // apply repetition option to all textures
  repeatTextures(textures)

  return (
    // @ts-expect-error
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      {...props}
      map={diffuse[0]}
      uniforms={{
        uNoise: { value: props.noise || noise },
        uDiffuse: { value: diffuse },
        uNormal: { value: normal },
        uHeight: { value: height },
        uRepeat: { value: repeat },
      }}
      vertexShader={glsl`
        varying vec3 csm_vWorldPosition;
      `}
      fragmentShader={glsl`
        varying vec3 csm_vWorldPosition;
        varying vec3 csm_vNormal;
        
        vec3 csm_NormalMap;
        
        precision mediump float;
        uniform sampler2D uNoise;
        uniform sampler2D uDiffuse[${diffuse.length}];
        uniform sampler2D uNormal[${normal.length}];
        uniform sampler2D uHeight[${normal.length}];
        uniform float uRepeat[${repeat.length}];

        

        ${glslNoise}
        ${paralax}

        // FRAGMENT OUT ----------------------------------------------------------------
        void main(){
          float r = 20.0;
          vec2 rUv = vUv * r;
          vec3 angle = viewAngle(-vViewPosition, normalize( vNormal ), normalize( vViewPosition ), rUv);
          vec2 pUv =  parallaxMap(angle, 0.35/r, 32.0, 32.0, uHeight[0], rUv);
          csm_DiffuseColor = texture2D(uDiffuse[0], pUv);
          csm_NormalMap = texture2D(uNormal[0], pUv).xyz;
        }
      `}
      patchMap={{
         csm_NormalMap: {
          "#include <normal_fragment_maps>": glsl`
            vec3 mapN = csm_NormalMap;
            mapN.xy *= normalScale;
            normal = (perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection ));
          `,
        },
      }}
    />
  );
}