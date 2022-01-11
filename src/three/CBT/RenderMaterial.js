import { extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import glsl from 'glslify';
import utils from './utils.js';

// RenderMaterial
extend({
    RenderMaterial: shaderMaterial(
        { tDiffuse: null, size: 3, scale: 5.0, width: 1.0, height: 1.0, subdivision: 0.0 },
        glsl`
            precision highp float;
            varying vec2 vUv;
            uniform float scale;
            uniform int size;
            uniform float width;
            uniform float height;
            uniform float subdivision;
            vec3 Position;
            
            ${utils}
        
            void main() {
                vUv = uv;
                float index = floor(float(gl_VertexID) / 3.0) / pow(2.0, subdivision);
                float vertex = mod(float(gl_VertexID), 3.0);
                float s = mod(float(gl_VertexID) / 3.0, pow(2.0, subdivision));
        
                mat3x3 matrix = computeMatrix(index);
                mat3x3 subMatrix = subdivideTriangle(matrix, s, subdivision);

        
                mat2x3 faceVertices = mat2x3(vec3(0, 0, 1), vec3(1, 0, 0));
                faceVertices = subMatrix * faceVertices;
        
                float centerOffset = ((scale - 1.0) / 2.0);
        
                // no z alt:
                // Position = (vec3(faceVertices[0][int(vertex)], faceVertices[1][int(vertex)], 0) * scale) - vec3(centerOffset, centerOffset, 0.0);
                
                // fit to screen
                // Position = (vec3(faceVertices[0][int(vertex)], faceVertices[1][int(vertex)], 0) * scale) - centerOffset;

                // no scale
                Position = (vec3(faceVertices[0][int(vertex)], faceVertices[1][int(vertex)], 0));
                
                gl_Position = projectionMatrix * modelViewMatrix *  vec4(Position, 1.0);
            }
        `,
        glsl`
            varying vec2 vUv;
            uniform sampler2D tDiffuse;
            void main() {
                // gl_FragColor = vec4(texture2D(map, vUv).rgb,1.0);
                gl_FragColor = vec4(1.0,1.0,1.0,1.0);
            }
        `
    )
})