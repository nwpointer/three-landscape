import { RepeatWrapping } from "three";
import glsl from "glslify";
import { ShaderMaterial } from "three";

export function MacroMaterial(parent) {
  parent.props.macroMap.wrapT = RepeatWrapping;
  parent.props.macroMap.wrapS = RepeatWrapping;
  parent.props.macroMap.needsUpdate = true;
  return new ShaderMaterial({
    uniforms: {
      variationMap: { value: parent.props.macroMap }
    },
    vertexShader: glsl`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: glsl`
      precision highp float;
      uniform sampler2D variationMap;
      varying vec2 vUv;
      void main() {
        gl_FragColor = 
        texture2D(variationMap, vUv/ 4.0) / 3.0 + 1.4 -
        texture2D(variationMap, vUv*4.0);
        
        gl_FragColor.w = 0.5;
        gl_FragColor.w = max(0.5, (texture2D(variationMap, vUv*8.0).r / 1.5 + texture2D(variationMap, vUv).r / 1.5)/2.0);
      }
    `
  });
}
