import { Color } from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

const ColorShiftMaterial = shaderMaterial(
  { time: 0, color: new Color(0.2, 0.0, 0.1) },
  // vertex shader
  `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  // fragment shader
  `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        gl_FragColor.rgba = vec4(0.5 + 0.3 * sin(vUv.yxx + time) + color, 1.0);
      }
    `
);

extend({ ColorShiftMaterial });
