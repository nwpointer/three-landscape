import { MeshStandardMaterial, RepeatWrapping } from "three";
import React from "react";

class TriplanarStandardMaterialImpl extends MeshStandardMaterial {
    // _splats = { value: [] };
    _verticalMap = { value: [] };
    _triplanar = { value: true };
    // parameters = {};
    // _diffuseMaps = { value: [] };
    // _detailMaps = { value: [] };
    // _normalMaps = { value: [] };
    // _normalWeights = { value: [] };
    // _scale = { value: [] };
    // _detailScale = { value: [] };
    // _saturation = { value: [] };
    // _brightness = { value: [] };
    // _noise = { value: undefined };

    constructor(parameters) {
        super(parameters);
        // this._verticalMap = parameters.verticalMap;
        // this.setValues(parameters);
        this.parameters = parameters;
        // console.log(parameters)
        this._verticalMap.value = parameters.verticalMap
        this._triplanar.value = parameters.triplanar;
        // this._normalWeights.value = this._normalWeights.value.length > 0 ? this._normalWeights.value : new Array(12).fill("0.75");
        // todo estimate scale
    }

    onBeforeCompile(shader) {
        shader.extensions = {
            derivatives: true,
            shaderTextureLOD: true,
        };

        // const { normalMaps, normalMap, diffuseMaps, splats, noise } = this.parameters;
        // shader.uniforms["splats"] = this._splats;
        shader.uniforms["verticalMap"] = this._verticalMap;
        shader.uniforms["triplanar"] = this._triplanar;

        // shader.uniforms["diffuseMaps"] = this._diffuseMaps;
        // shader.uniforms["normalMaps"] = this._normalMaps;
        // shader.uniforms["detailMaps"] = this._detailMaps;
        // shader.uniforms["normalWeights"] = this._normalWeights;
        // shader.uniforms["scale"] = this._scale;
        // shader.uniforms["detailScale"] = this._detailScale;
        // shader.uniforms["saturation"] = this._saturation;
        // shader.uniforms["brightness"] = this._brightness;
        // if (noise) shader.uniforms["noise"] = { value: noise };

        // make sure that these textures tile correctly
        // [...(normalMaps || []), ...splats, ...diffuseMaps, normalMap, noise]
        //     .filter((d) => d !== null && d !== undefined)
        //     .forEach((t) => {
        //         t.wrapS = RepeatWrapping;
        //         t.wrapT = RepeatWrapping;
        //     });

        shader.vertexShader = shader.vertexShader
            .replace(
                `varying vec3 vViewPosition;`,
                `
                varying vec3 vViewPosition;
                varying mat4 vModelMatrix;
                varying vec3 vPosition;
                varying vec3 vNorm;
                varying vec3 vTransformed;
                varying vec3 vWorldPos;
                `
            )
            .replace(
                `#include <worldpos_vertex>`,
                `
                #include <worldpos_vertex>
                vModelMatrix = modelMatrix;
                vPosition = position.xyz;
                vNorm = normal;
                vTransformed = transformed;
                vWorldPos = (modelMatrix * vec4(vTransformed, 1)).xyz;
                `
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "uniform float opacity;",
                `
                uniform float opacity;
                varying mat4 vModelMatrix;
                uniform mat4 modelMatrix;
                uniform mat4 modelViewMatrix;
                varying vec3 vPosition;
                varying vec3 vNorm;
                uniform sampler2D displacementMap;
                varying vec3 vTransformed;
                uniform sampler2D verticalMap;
                uniform bool triplanar;
                varying vec3 vWorldPos;

                vec4 triplanarSample(vec3 pos, vec3 normal, vec3 ds, sampler2D map, sampler2D verticalMap) {

                    vec4 dx = (texture2D(verticalMap, pos.zy *2.0)) * 0.9;
                    vec4 dy = (texture2D(verticalMap, pos.xz *2.0)) * 0.9;
                    vec4 dz = texture2D(map, pos.xy);

                    // vec4 dx = vec4(1.0, 0.0, 0.0, 1.0);
                    // vec4 dy = vec4(0.0, 1.0, 0.0, 1.0);
                    // vec4 dz = vec4(0.0, 0.0, 1.0, 1.0);

                    vec3 weights = pow(abs(normal.xyz), vec3(1.0));
                    weights = weights / (weights.x + weights.y + weights.z);

                    // float d = 0.75;
                    // float v = ds.x < d? (d-ds.x)/5.0 : 0.0;
                    
                    // return abs(dx * weights.x + dy * weights.y + dz * weights.z
                    // - vec4(v,v,v, 0.0));
                    
                    return abs(dx * weights.x + dy * weights.y + dz * weights.z);
                }
                vec4 triplanarNormal(vec3 pos, sampler2D map) {
                    return texture2D(map, pos.xy);
                }
                `
            )
            .replace(
                "#include <map_fragment>",
                `
                #include <map_fragment>

                vec3 ds = texture2D(displacementMap, vUv).xyz;
                vec3 n = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
                vec3 worldPosition = (modelMatrix * vec4(vPosition, 1)).xyz;
                vec3 worldTransform = (modelMatrix * vec4(vTransformed, 1)).xyz;
                worldTransform += vec3(0.5, 0.5, 0.0);
                vec3 worldSpaceNormal = (modelMatrix * vec4(vNorm, 0.0)).xyz;

                vec3 dFdxPos = dFdx( vWorldPos );
                vec3 dFdyPos = dFdy( vWorldPos );
                vec3 facenormal = normalize( cross(dFdxPos,dFdyPos ));



                // idea: checkign dF gives slope on face and a faceted look
                // For the purposes of identifying top, left, right sides its more about total vertical distance traveled
                // it if this pixel has traveled more in the y then its' top projected x distance its not vertical.

                // sample all surrounding pixels in the hightmap, 
                // work out the x distance associated with one pixel width.
                // if the height change > the width then its not vertical
                // this should give accurate results down to the resolution of the heightmap.
                /// or not.




                // this is in object space

                // idea: modulate accuracy based on 
                float o = 0.0015;
                float h = dot(texture2D(displacementMap, vUv),  vec4(1,0,0,1));
                float hx = dot(texture2D(displacementMap, vUv + vec2( o, 0.0 )), vec4(1,0,0,1));
                float hy = dot(texture2D(displacementMap, vUv + vec2( 0.0, o )),  vec4(1,0,0,1));

                float dScale = 25.0;
                float dx = (hx - h) * dScale;
                float dy = (hy - h) * dScale;

                vec3 heightNormal = (cross(vec3(1.0,0.0,dx), vec3(0.0,1.0,dy)));

                // diffuseColor = vec4(1.0,0.0,dx,1.0);
                // diffuseColor = vec4(0.0,1.0,dy,1.0);
                
                // diffuseColor = vec4(facenormal, 1.0);
                // diffuseColor = vec4(heightNormal, 1.0);

                // diffuseColor = vec4(n, 1.0);
                // diffuseColor= vec4(worldTransform.z*100.0, 0,0.0, 1.0);


                // diffuseColor= vec4(worldTransform.rg, 0.0, 1.0);
                // diffuseColor = texture2D(map, vUv);

                

                if(facenormal.z > 0.5 && n.b > 0.5) {
                    // n.b = 0.0;
                    // n.r = 1.0;
                }

                // diffuseColor = vec4(heightNormal,1.0);
                // diffuseColor = vec4(n,1.0);
                
                if (triplanar) {
                    // diffuseColor = triplanarSample(worldTransform, n, map, verticalMap);
                    diffuseColor = triplanarSample(worldTransform, heightNormal, ds, map, verticalMap);
                    // diffuseColor = triplanarSample(worldTransform, facenormal, normalMap, normalMap);
                    // diffuseColor = triplanarSample(worldTransform, facenormal, map, verticalMap);
                }
            `
            )
        // .replace(
        //     "#include <normal_fragment_maps>",
        //     `
        //     #ifdef OBJECTSPACE_NORMALMAP
        //         // normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
        //         // normal = triplanarNormal( vUv, normalMap ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
        //         #ifdef FLIP_SIDED
        //             normal = - normal;
        //         #endif
        //         #ifdef DOUBLE_SIDED
        //             normal = normal * faceDirection;
        //         #endif
        //         normal = normalize( normalMatrix * normal );
        //     #elif defined( TANGENTSPACE_NORMALMAP )
        //         // vec3 mapN = triplanarNormal( vUv, normalMap ).xyz * 2.0 - 1.0;
        //         // vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
        //         vec3 mapN = heightNormal.xyz;
        //         mapN.xy *= normalScale;
        //         #ifdef USE_TANGENT
        //             normal = normalize( vTBN * mapN );
        //         #else
        //             normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
        //         #endif
        //     #elif defined( USE_BUMPMAP )
        //         normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
        //     #endif
        //     `
        // );
    }

    set triplanar(v) {
        this._triplanar.value = v;
    }

    // set splats(v) {
    //     this._splats.value = v;
    // }
    // set normalMaps(v) {
    //     this._normalMaps.value = v;
    // }
    // set normalWeights(v) {
    //     this._normalWeights.value = v;
    // }
    // set detailMaps(v) {
    //     this._detailMaps.value = v;
    // }
    // set diffuseMaps(v) {
    //     this._diffuseMaps.value = v;
    // }
    // set scale(v) {
    //     this._scale.value = v;
    // }
    // set detailScale(v) {
    //     this._detailScale.value = v;
    // }
    // set saturation(v) {
    //     this._saturation.value = v;
    // }
    // set brightness(v) {
    //     this._brightness.value = v;
    // }
    // set noise(v) {
    //     this._noise.value = v;
    // }
}

const TriplanarStandardMaterial = React.forwardRef((props = {}, ref) => {
    // const material = React.useMemo(() => new TriplanarStandardMaterialImpl(props), props);
    const [material] = React.useState(() => new TriplanarStandardMaterialImpl(props));

    const { verticalMap } = props;

    [verticalMap].forEach(t => {
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
    })

    return <primitive dispose={undefined} object={material} ref={ref} attach="material" {...props} />;
});

export default TriplanarStandardMaterial;

