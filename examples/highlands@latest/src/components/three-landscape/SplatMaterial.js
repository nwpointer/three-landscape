import React from "react";
import { MeshStandardMaterial, RepeatWrapping } from "three";
import utilityFunctions from "./utilityFunctions.glsl";

class SplatStandardMaterialImpl extends MeshStandardMaterial {
  _splats = { value: [] };
  _diffuseMaps = { value: [] };
  _detailMaps = { value: [] };
  _normalMaps = { value: [] };
  _normalWeights = { value: [] };
  _scale = { value: [] };
  _detailScale = { value: [] };
  _saturation = { value: [] };
  _brightness = { value: [] };
  _noise = { value: undefined };

  constructor(parameters) {
    super(parameters);
    this.setValues(parameters);
    this.parameters = parameters;
    this._normalWeights.value = this._normalWeights.value.length > 0 ? this._normalWeights.value : new Array(12).fill("0.75");
    // todo estimate scale
  }

  onBeforeCompile(shader) {
    shader.extensions = {
      derivatives: true,
      shaderTextureLOD: true,
    };

    const { normalMaps, normalMap, diffuseMaps, splats, noise } = this.parameters;

    if (!splats) {
      throw new Error("splats is a required properties of SplatStandardMaterial");
    }

    shader.uniforms["splats"] = this._splats;
    shader.uniforms["diffuseMaps"] = this._diffuseMaps;
    shader.uniforms["normalMaps"] = this._normalMaps;
    shader.uniforms["detailMaps"] = this._detailMaps;
    shader.uniforms["normalWeights"] = this._normalWeights;
    shader.uniforms["scale"] = this._scale;
    shader.uniforms["detailScale"] = this._detailScale;
    shader.uniforms["saturation"] = this._saturation;
    shader.uniforms["brightness"] = this._brightness;
    if (noise) shader.uniforms["noise"] = { value: noise };

    // make sure that these textures tile correctly
    [...(normalMaps || []), ...splats, ...diffuseMaps, normalMap, noise]
      .filter((d) => d != null && d != undefined)
      .forEach((t) => {
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
      });

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "uniform float opacity;",
        `
        uniform float opacity;
        uniform sampler2D noise;
        ${sampler2d("splats", this._splats.value)}
        ${sampler2d("diffuseMaps", this._diffuseMaps.value)}
        ${sampler2d("detailMaps", this._detailMaps.value)}
        ${sampler2d("normalMaps", this._normalMaps.value)}
        ${float("normalWeights", this._normalWeights.value)}
        ${float("scale", this._scale.value)}
        ${float("detailScale", this._detailScale.value)}
        ${float("saturation", this._saturation.value)}
        ${float("brightness", this._brightness.value)}
        

        ${utilityFunctions}
        `
      )
      .replace(
        "#include <map_fragment>",
        `
        #include <map_fragment>
        vec4 color_override = ${computeDiffuse({
          splats,
          noise,
          diffuseMaps: this._diffuseMaps.value,
          saturation: this._saturation.value,
          brightness: this._brightness.value,
        })};
        diffuseColor = vec4(color_override.rgb, 1.0);
      `
      )
      .replace(
        "#include <normal_fragment_maps>",
        `
        vec3 mapN = texture2D( normalMap, vUv ).xyz *1.25 -0.25;
        vec4 _b = vec4(mapN.rgb, 1.0);
        ${computeNormal({ normalMaps: this._normalMaps.value, detailMaps: this._detailMaps.value, splats, noise })};

        mapN = _b.rgb;
        mapN.xy *= normalScale;

        #ifdef USE_TANGENT
          normal = normalize( vTBN * mapN );
        #else
          normal = perturbNormal2Arb( -vViewPosition, normal, mapN, faceDirection );
        #endif
      `
      );
  }

  set splats(v) {
    this._splats.value = v;
  }
  set normalMaps(v) {
    this._normalMaps.value = v;
  }
  set normalWeights(v) {
    this._normalWeights.value = v;
  }
  set detailMaps(v) {
    this._detailMaps.value = v;
  }
  set diffuseMaps(v) {
    this._diffuseMaps.value = v;
  }
  set scale(v) {
    this._scale.value = v;
  }
  set detailScale(v) {
    this._detailScale.value = v;
  }
  set saturation(v) {
    this._saturation.value = v;
  }
  set brightness(v) {
    this._brightness.value = v;
  }
  set noise(v) {
    this._noise.value = v;
  }
}

const computeDiffuse = ({ diffuseMaps = [], splats, saturation = [], brightness = [] }) => {
  return diffuseMaps
    .filter((d) => d !== null && d !== undefined)
    .map((diffuse, i) => {
      // base rgba values
      let colorValue = `textureNoTile(diffuseMaps[${i}], noise, vUv * vec2(scale[${i}],scale[${i}]))`;
      let alphaValue = `texture2D(splats[${splatIndex(i)}], vUv).${splatChannel(i)}`;

      // optional modifiers
      if (saturation && i < saturation.length) colorValue = `czm_saturation(${colorValue}, saturation[${i}])`;
      if (brightness && i < brightness.length) colorValue = `(${colorValue} + vec4(brightness[${i}], brightness[${i}], brightness[${i}], 0.0))`;

      return `${colorValue} * ${alphaValue}`;
    })
    .join(" + ");
};

const computeNormal = ({ normalMaps = [], detailMaps = [], splats }) => {
  const norms = normalMaps
    .filter((n) => n !== null && n !== undefined)
    .map((normal, i) => {
      let colorValue = `textureNoTile(normalMaps[${i}], noise, vUv * vec2(scale[${i}],scale[${i}]))`;
      let alphaValue = `texture2D(splats[${splatIndex(i)}], vUv).${splatChannel(i)}`;

      let zeroN = `vec4(0.5, 0.5, 1, 1)`;
      const n = `mix(${zeroN}, ${colorValue}, ${alphaValue} * normalWeights[${i}])`;
      return `_b = blend_rnm(_b, ${n})`;
    })
    .join(`; \n`);

  const details = detailMaps
    .filter((n) => n !== null && n !== undefined)
    .map((normal, i) => {
      let colorValue = `textureNoTile(normalMaps[${i}], noise, vUv * vec2(detailScale[${i}],detailScale[${i}]))`;
      let alphaValue = `texture2D(splats[${splatIndex(i)}], vUv).${splatChannel(i)}`;

      let zeroN = `vec4(0.5, 0.5, 1, 1)`;
      const n = `mix(${zeroN}, ${colorValue}, ${alphaValue} * 0.75)`;
      return `_b = blend_rnm(_b, ${n})`;
    });

  return norms + "; \n" + details;
};

const sampler2d = (name, data) => (data && data.length ? `uniform sampler2D ${name}[${data.length}];` : "");
const float = (name, data) => (data && data.length ? `uniform float ${name}[10];` : "");

// utility functions
function splatIndex(i) {
  return Math.floor(i / 4);
}
function splatChannel(i) {
  return ["r", "g", "b", "a"][i % 4];
}

export const SplatStandardMaterial = React.forwardRef((props, ref) => {
  const [material] = React.useState(() => new SplatStandardMaterialImpl(props));
  return <primitive dispose={undefined} object={material} ref={ref} attach="material" {...props} />;
});

