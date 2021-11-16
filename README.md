# Three landscape

A growing collection of React-three-fiber compatible abstractions for rendering high quality, large scale landscapes scenes. I've been researching how AAA games render terrain and am replicating any browser compatible techniques here.

[<img src="/thumbnail.png">](https://three-landscape.vercel.app/)

Note: this package is not capable of procedurally generating terrain. Height maps and other textures must be authored offline in programs such as [WorldCreator](https://www.world-creator.com/) or generated at run time with custom logic. This is something I'm interested in for its potential to reduce bundle sizes but is out of scope for this module.

### Demo:

https://three-landscape.vercel.app/

Source code for example is available in the /examples/highland@latest directory

### Installation

`npm install three-landscape`

# Documentation

### SplatStandardMaterial

Custom material that extends the meshStandardMaterial with additional properties for splat mapping. Splat mapping makes it possible to render terrains with much higher texture detail while reducing memory usage and bundle size: http://wiki.polycount.com/wiki/Splat

Can use used in vanilla (non react) Three.js projects by importing from the /three directory `import SplatStandardMaterial from three-lanscape/three`

#### supports:

- all the props & behaviors of meshStandardMaterial
- seamless tile blending (aka texture bombing)
- terrain and detail normal maps
- texture saturation and brightness filters for additional creative control 

#### new props:

- splats*: [Texture] (expects splat data in rgb and a channels)
- normalMaps: [Texture]
- normalWeights: [float]
- diffuseMaps*: [Texture]
- scale*: [float] (size of terrain tiles)
- saturation: [float]
- brightness: [float]
- noise*: Texture 

\* required prop

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
        splats={[splat1, splat2]}
        normalMap={normal}
        normalMaps={[n1, n2, n3]}
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

See example directory for advanced usage and example textures but 

Note: The textures are not covered by the MIT license and should not be used with out first acquiring the rights to do so.

---

### useProgressiveTexture

Similar to useTexture from [drie](https://github.com/pmndrs/drei) but progressively loads higher quality textures over time.

```js
function Terrain(){
    const [quality, textures] = useProgressiveTextures([
      ['/heightmap.png','/normalmap.png'],
      ['/hd/heightmap.png','/hd/normalmap.png']
    ])

    const [displacement, normal] = textures[quality]
    return(
      <mesh>
        <planeBufferGeometry/>
        <meshStandardMaterial normalMap={normal} displacementMap={displacement} />
      </mesH>
    )
}
```

It is a texture loader that accepts an array of url arrays and returns: Array of texture batches and an int holding the index of the highest quality texture batch that has been downloaded.

All textures in a batch (['/hd/heightmap.png','/hd/normalmap@0.5.png']) are resolved before moving on to the next highest quality level
To get performance benefits, resource batches should be of ordered by ascending quality.

Note: as long as you serve a /basis_transcoder.js and /basis_transcoder.wasm useProgressiveTexture can also auto resolve highly compressed basis textures.
See the BasisTextureLoader and Basisu project for more details: https://github.com/BinomialLLC/basis_universal

<!--

### Anti terracing hightlmaps
when the mesh density of a terrain is high and height differece exceeds > 255 can look terraced.

this shader averages the the contributions of connected vertex, reducing/removing the terracing effect

###RayleighFog
more realistic implementation of Rayleigh scattering, also known as atmostpheric scattering

###Globe
takes grid of children and wraps geometry arround a sphere of size R

### Mirror grid
creates a grid with repeating, mirrored instances of a child mesh. Usefull for artifitially creating the appearence of infinite terrain from certain viewpoints. Works best with self similar terrains like moutain ranges or sand dunes.

<MirrorGrid>
  <Terrain />
</MirrorGrid>

### vector field material
Like height maps that displace allong the y but allow x,y and z vector values for displacement. Allows for things like overhangs ect.
https://www.youtube.com/watch?v=In1wzUDopLM&t=2586s&ab_channel=GDC


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

Thought it might be fun to let people vote on new feature ideas! If you're interested in a particular feature leave a thumbs up on the assosiated issue:

[view issues sorted by most votes](https://github.com/nwpointer/three-landscape/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc)


- Optional tri-planar projection (helps reduce texture stretching on extreme hight differentials)

- Anti height terracing shader (height terracing affects dense meshes w high displacement scale)

- Optional noise / shader based texture blending for sharper splat transitions w/o crazy hd splatmaps

- Texture atlas support (bundles multiple textures into a single file, sidestepping webgl's 16 texture per material limit)

- Infinite mirror grid for faking infinite terrain in self similar environments (mountains, sand dunes)

- Support for wrapping textures onto spheres / semi sphere

- MaterialTransition (Animates transitions between materials. This pairs well with useProgressiveTexture allowing you to fade in new textures quality levels as they are resolved.)

- Quad-tree based terrain sectors that load terrain based on proximity to the camera or a character controller

- Arbitrary local mesh detail based on user supplied criteria or via BTree. Avoid's t-junction height gaps caused by adjacent meshes of different mesh density.

- Utilities for weighted grass / rock dispersal.

- Volumetric fog

- Custom water shaders

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Please Lint and test your code before submitting.

## License

MIT License does not apply to any of the image files in the examples directory
