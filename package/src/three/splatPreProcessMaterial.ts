import { ShaderMaterial } from "three";
import glsl from "glslify";
import sort from "../util/sort";

export function splatPreProcessMaterial(splats, surfaceLimit = 4.0, channelCount = 4.0) {
  console.log({surfaceLimit})
  const uniforms = {
    uSplats: { value: splats },
    uMode: { value: 0 },
    surfaceLimit: { value: surfaceLimit },
  };
  const splatCount = uniforms.uSplats.value.length;
  const n = splatCount * channelCount;
  return new ShaderMaterial({
    uniforms,
    vertexShader: glsl`
        precision highp float;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    fragmentShader: glsl`
        precision highp float;
        uniform sampler2D uSplats[${splatCount}];
        uniform int uMode;
        uniform int surfaceLimit;
        varying vec2 vUv;
        void main() {
          vec4 color = texture(uSplats[1], vUv);

          // construct a array of vec2s with the index and weight of each surface from the splatmaps
          vec2[${n}] surfaces = vec2[${n}](
            ${Array(splatCount)
              .fill(0)
              .map((v, i) => {
                const index = i.toString();
                return glsl`
                vec2(${(
                  (i * 4 + 0) /
                  n
                ).toString()}, texture(uSplats[${index}], vUv).r),
                vec2(${(i * 4 + 1) / n}, texture(uSplats[${index}], vUv).g),
                vec2(${(i * 4 + 2) / n}, texture(uSplats[${index}], vUv).b),
                vec2(${(i * 4 + 3) / n}, texture(uSplats[${index}], vUv).a)`;
              })
              .join(",")}
          );
        
          
          

          ${sort("surfaces")}

          // float surfaceSum = 0.0;
          // for(int i = 0; i < surfaceLimit; i++) surfaceSum += surfaces[i].y;
          // for(int i = 0; i < surfaceLimit; i++) surfaces[i].y /= surfaceSum;




          // x is the index, y is the weight
          if(uMode == 0){
            gl_FragColor = vec4(surfaces[0].x, surfaces[1].x, surfaces[2].x, surfaces[3].x);
          } else {
            gl_FragColor = vec4(surfaces[0].y, surfaces[1].y, surfaces[2].y, surfaces[3].y);
          }
        }
      `,
  });
}
