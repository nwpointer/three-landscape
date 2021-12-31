import { extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import glsl from 'glslify';

// FullscreenSampleMaterial
extend({
  FullscreenSampleMaterial: shaderMaterial(
    {
      map: undefined
    },
    glsl`
      varying vec2 vUv;
      void main() {
        // gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position = vec4(position * 2.0, 1.0);
        vUv = uv;
      }
    `,
    glsl`
      varying vec2 vUv;
      uniform sampler2D map;
      void main() {
        gl_FragColor = texture2D(map, vUv);
  
        // exaggerate the alpha channel and send it to the red so its visible
        gl_FragColor = vec4(gl_FragColor.a * 50.0, 0,0, gl_FragColor.a);
  
        // gl_FragColor = vec4(vUv, 0.0,1.0);
      }
    `
  )
})
