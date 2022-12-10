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

## TerrainMaterial

Custom material that extends the meshStandardMaterial with additional properties for splat mapping. Splat mapping makes it possible to render terrains with much higher texture detail while reducing memory usage and bundle size: http://wiki.polycount.com/wiki/Splat


### Features:

- all the props & behaviors of meshStandardMaterial
- Splatmaps
- Texture saturation and tint
- Stochastic sampling
- Trilinear mapping
- Mutltiple material blending options

```js
function MySuperCoolTerrain() {
  const textures = useTexture([
    ... list of up to 16* textures
  ]);

  return (
    <mesh>
      <planeBufferGeometry args={[1024, 1024, 1024, 1024]} ref={geometry => {
        if(geometry){
          geometry.attributes.uv2 = geometry.attributes.uv.clone();
          geometry.needsUpdate = true;
        }
      }} />
      <TerrainMaterial
        splats={[textures[1]}
        surfaces={[rock, clif, mud, grass]}
        normalMap={textures[2]}
        displacementMap={textures[3]}
        displacementScale={100.0}
      />
    </mesh>
  );
}
```

#### New props:

- splats: Texture[] (expects 4 channel splat data in rgba)
- noise: Texture; used for stocastic sampling
- Surfaces: Surface[];

Most of the new features are configured by modifying surface properties.

### Surfaces:
Surfaces are related groups of textures and properties that define how to render part of the terrain. Rock, grass, sand etc would all be seperate surfaces.

example:
```
const grass = {
    diffuse: texture[1],
    normal: texture[2],
    normalStrength: 0.4,
    repeat: 200,
    gridless: true,
    saturation: 0.7,
    tint: new Vector4(0.8,1.0,0.8,1),
};
```

### Blend Modes:
by default all surfaces will be alpha blended based on the wieghts defined in the provided spatmap(s). This generally looks fine from a distance but you may want to try a differnt blend mode if the camera is likely to be near the grownd. blend mode are a surface spesific setting.

### noise blending:
uses randon noise and splat weights to create a detailed edge. To fully controll the shape, you can optionally provide one or more octaves of noise.
```
grass.blend = {
  mode: "noise",
  octaves: {
    blur:0.5,
    amplitude: 1.25,
    wavelength: 1024.0 * 16.0,
    accuracy: 1.25
  }
}
```
To get a better understanding of how each noise parameter effects the edge check out this interactive demo: https://www.redblobgames.com/x/1730-terrain-shader-experiments/noisy-hex-rendering.html

Please see the example directory for advanced usage and example textures.

Note: The textures are not covered by the MIT license and should not be used with out first acquiring the rights to do so.

---

## useProgressiveTexture

Similar to useTexture from [drie](https://github.com/pmndrs/drei) but progressively loads higher quality textures over time.

```js
function Terrain(){
    const [quality, textures] = useProgressiveTextures([
      ['/heightmap.png','/normalmap.png'], // batch 1
      ['/hd/heightmap.png','/hd/normalmap.png'] // batch 2
    ])

    const [displacement, normal] = textures[quality]
    return(
      <mesh>
        <planeBufferGeometry/>
        <meshStandardMaterial 
          color="green" 
          normalMap={normal} 
          displacementMap={displacement} 
        />
      </mesH>
    )
}
```

It is a texture loader that accepts an array of url arrays and returns: Array of texture batches and an int holding the index of the highest quality texture batch that has been downloaded.

All textures in a batch (['/hd/heightmap.png','/hd/normalmap@0.5.png']) are resolved before moving on to the next highest quality level
To get performance benefits, resource batches should be of ordered by ascending quality.

### Basis textures:

Note: as long as you serve provide a /basis_transcoder.js and /basis_transcoder.wasm useProgressiveTexture can also auto resolve highly compressed basis textures.

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

## License

MIT License does not apply to any of the image files in the examples directory
