import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { TGALoader } from 'three-stdlib'
import utilityFunctions from './utilityFunctions.glsl'

// loads textures and renders a terrain mesh
export function Terrain({ tiles, splats, displacement, normal, diffuse, layers, ...materialParameters }) {
  const displacementMap = useLoader(THREE.TextureLoader, displacement)
  const normalMap = useLoader(THREE.TextureLoader, normal)
  const noise = useLoader(THREE.TextureLoader, '/simplex-noise.png')
  const ns = []
  const ds = []
  const ss = []

  for (let i = 0; i < splats.length; i++) {
    ss.push(useLoader(TGALoader, splats[i]))
  }

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].normal) ns.push(useLoader(THREE.TextureLoader, tiles[i].normal))
    if (tiles[i].diffuse) ds.push(useLoader(THREE.TextureLoader, tiles[i].diffuse))
  }

  ;[...ns, ...ds, noise].map((t) => {
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
  })

  materialParameters.displacementMap = materialParameters.displacementMap || displacementMap
  materialParameters.normalMap = materialParameters.normalMap || normalMap

  return <TerrainMesh materialParameters={materialParameters} splats={ss} normals={ns} diffuses={ds} layers={layers} noise={noise} />
}

// takes loaded textures and draws a plan using the custom Material
export function TerrainMesh({ materialParameters, layers, splats, normals, diffuses, noise }) {
  const { width, height } = materialParameters.displacementMap.image
  const material = terrainMaterial({ materialParameters, layers, splats, normals, diffuses, noise })

  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <planeBufferGeometry args={[width, height, width, height]} />
    </mesh>
  )
}

// extends and parametrizes the meshStandardMaterial
export function terrainMaterial({ materialParameters, layers, splats, normals, diffuses, noise }) {
  const material = new THREE.MeshStandardMaterial({
    ...materialParameters
  })

  material.onBeforeCompile = (shader) => {
    shader.extensions = {
      derivatives: true
    }
    shader.uniforms = {
      ...shader.uniforms,
      uNoise: { value: noise },
      uNormal: { value: normals },
      uDiffuse: { value: diffuses },
      uSplat: { value: splats }
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'uniform float opacity;',
        `
        uniform float opacity;
        uniform sampler2D uNoise;
        uniform sampler2D uNormal[${normals.length}];
        uniform sampler2D uDiffuse[${diffuses.length}];
        uniform sampler2D uSplat[${splats.length}];

        ${utilityFunctions}
        `
      )
      .replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        vec4 color_override = ${computeDiffuseByLayer(layers)};
        diffuseColor = vec4(color_override.rgb, 1.0);
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        `
        vec3 mapN = texture2D( normalMap, vUv ).xyz *1.25 -0.25;
        vec4 _b = vec4(mapN.rgb, 1.0);
        ${computeNormalByLayer(layers)};

        mapN = _b.rgb;
        mapN.xy *= normalScale;

        #ifdef USE_TANGENT
          normal = normalize( vTBN * mapN );
        #else
          normal = perturbNormal2Arb( -vViewPosition, normal, mapN, faceDirection );
        #endif
      `
      )
  }

  return material
}

// use js to 'compile' parameterized glsl code required to combine diffuse layers
function computeDiffuseByLayer(layers) {
  return layers
    .filter((l) => l.diffuse)
    .map(({ diffuse }, i) => {
      const [di, si, sc] = indexes(diffuse, i)
      const [rx, ry] = diffuse.repeat
      let splatValue = `texture2D(uSplat[${si}], vUv).${sc}`
      let colorValue = `textureNoTile(uDiffuse[${di}], vUv * vec2(${rx},${ry}))`
      if (diffuse.saturation) colorValue = `czm_saturation(${colorValue}, ${diffuse.saturation})`
      return `${colorValue} * ${splatValue}`
    })
    .join(' + ')
}

// use js to 'compile' parameterized glsl code required to combine normal layers
function computeNormalByLayer(layers) {
  return layers
    .filter((l) => l.normal)
    .map(({ normal }, i) => {
      const [di, si, sc] = indexes(normal, i)
      const [rx, ry] = normal.repeat
      let splatValue = `texture2D(uSplat[${si}], vUv).${sc}`
      let colorValue = `textureNoTile(uNormal[${di}], vUv * vec2(${rx},${ry}))`
      let zeroN = `vec4(0.5, 0.5, 1, 1)`
      const n = `mix(${zeroN}, ${colorValue}, ${splatValue}*${normal.weight || '1.0'})`
      return `_b = blend_rnm(_b, ${n})`
    })
    .join(`; \n`)
}

// utility functions
function sIndex(i) {
  return Math.floor(i / 4)
}
function sChannel(i) {
  return ['r', 'g', 'b', 'a'][i % 4]
}

function indexes(layer, i) {
  const di = layer.tile || i
  const si = sIndex(layer.splat || i)
  const sc = sChannel(layer.splat || i)
  return [di, si, sc]
}
