# Three landscape

React-three-fiber compatible abstractions that make it easier to render high quality landscapes scenes

[<img src="/thumbnail.png">](https://three-landscape.vercel.app/)

This package is not capable of procedurally generating terrain. Height maps and other textures must be generated offline in programs such as [WorldCreator](https://www.world-creator.com/) or at run time with custom logic.

### Demo:

https://three-landscape.vercel.app/

source code for example is available in the /examples/highland@latest directory

### Installation

`npm install three-landscape`

# Documentation

### SplatStandardMaterial

custom material that extends the meshStandardMaterial with additional properties for splat mapping. Splat mapping makes it possible to render large high quality terrains with smaller smaller images.

unlike useProgressive Texture or MaterialTransition spatStandardMaterial can use used in vanilla (non react) Three.js projects.

#### supports:

- all the props & behaviors of meshStandardMaterial
- basis textures (highly compressed gpu friendly image format)
- seamless tile blending (aka texture bombing)
- global & local normals
- modify texture saturation and brightness

#### new props:

- splats: [Texture]
- normalMaps: [Texture]
- normalWeights: [float]
- diffuseMaps: [Texture]
- scale: [float]
- saturation: [float]
- brightness: [float]
- noise: Texture

```js
function Terrain() {
  const [displacement, normal, noise, d1, n1, d2, n2, d3, n3, d4, splat1, splat2] = useTexture([
    '/hd/heightmap.png',
    '/hd/normalmap.png',
    '/simplex-noise.png',
    '/Assets/Cliffs_02/Rock_DarkCrackyCliffs_col.jpg',
    '/Assets/Cliffs_02/Rock_DarkCrackyCliffs_norm.jpg',
    '/Assets/Rock_04/Rock_sobermanRockWall_col.jpg',
    '/Assets/Rock_04/Rock_sobermanRockWall_norm.jpg',
    '/Assets/Mud_03/Ground_WetBumpyMud_col.jpg',
    '/Assets/Mud_03/Ground_WetBumpyMud_norm.jpg',
    '/Assets/Grass_020/ground_Grass1_col.jpg',
    '/hd/splatmap_00.png',
    '/hd/splatmap_01.png'
  ])

  const { width, height } = displacement.image

  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeBufferGeometry args={[100, 100, width, height]} />
      <SplatStandardMaterial
        normalMap={normal}
        splats={[splat1, splat2]}
        normalMaps={[n1, n2, n3]}
        normalWeights={[1.0, 1.0, 1.0]}
        diffuseMaps={[d1, d2, d3, d4, d4, d3]}
        scale={[128 / 4, 128 / 2, 128, 128 * 2, 128, 128, 10]}
        noise={noise}
        displacementMap={displacement}
        displacementScale={10}
        displacementBias={-10}
      />
    </mesh>
  )
}
```

### useProgressiveTexture

Similar to useTexture from drie but progressively loads higher quality textures over time.


It is a texture loader that accepts an array of url arrays and returns: an int holding the index of the highest available texture batch and an Array of texture batches.

All textures in a batch (['/hd/heightmap.png','/hd/normalmap@0.5.png']) are resolved before moving on to the next highest quality level
To get performance benifits, resource batches should be of assending quality.

Note: as long as you serve a /basis_transcoder.js and /basis_transcoder.wasm useProgressiveTexture can also auto resolve highly compressed basis textures.
See the BasisTextureLoader and Basisu project for more details: https://github.com/BinomialLLC/basis_universal

```js
function Terrain(){
    const [highestQualityLoaded, textures] = useProgressiveTextures([
      ['/hd/heightmap.png','/hd/normalmap.png'],
      ['/hd/heightmap_hd.png','/hd/normalmap_hd.png']
    ])

    const [displacement, normal] = textures[highestQualityLoaded]
    ...
}
```

<!--

### MaterialTransition

Animates transitions between materials. This pairs well with useProgressiveTexture allowing you to fade in new textures quality levels as they are resolved.

#### props:

- speed: float seconds
  duration in seconds taken to transition to the next highest quality level.

- mesh: ref
  react ref of the containing mesh

```js
function Terrain(){
    const ref = useRef();
    const [SD, HD] = useProgressiveTextures(
        [t1, t1],
        [t2, t3]
    )
    return (
        <mesh ref={ref}>
            <plane>
            <MaterialTransition mesh={ref} speed={0.4}>
                <splatStandardMaterial {...SD}>
                <splatStandardMaterial {...HD}>
            </MaterialTransition>
        </mesh>
    )
}

```
-->

## Roadmap:


- MaterialTransition:
  Animates transitions between materials. This pairs well with useProgressiveTexture allowing you to fade in new textures quality levels as they are resolved.

- Quadtree based terrain sectors that load based on proximity to the camera or a character controller

- weighted grass / rock dispersal.

- volumetric fog

- custom water and river shaders

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Please Lint and test your code before submitting.

## License

MIT License does not apply to any of the image files in the examples directory
