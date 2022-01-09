import { extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import glsl from 'glslify';

// FullscreenSampleMaterial
extend({
  HudMaterial: shaderMaterial(
    {
      map: undefined,
      r: 2.0
    },
    glsl`
      varying vec2 vUv;
      uniform float r;
      void main() {
        // float r = 2.0; // ratio of screen to cover, r = 1.0 means half screen screen, r = 2.0 means quarter screen ect
        float s = pow(2.0, r); 
        float v = (1.0-s) / s;
        gl_Position = vec4(position/r + vec3(v, v, 0.0), 1.0);
        vUv = uv;
      }
    `,
    glsl`
      varying vec2 vUv;
      uniform sampler2D map;
      void main() {
        gl_FragColor = texture2D(map, vUv);
  
        // exaggerate the alpha channel and send it to the red so its visible
        // gl_FragColor = vec4(gl_FragColor.a * 50.0, 0,0, gl_FragColor.a);
  
        // gl_FragColor = vec4(vUv, 0.0,1.0);
      }
    `
  )
})
