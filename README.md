# Three landscape

A growing collection of React-three-fiber compatible abstractions for rendering high quality, large scale landscapes scenes. I've been researching how AAA games render terrain and am replicating any browser compatible techniques here.

[<img src="/thumbnail.png">](https://three-landscape.vercel.app/)

Note: this package is not capable of procedurally generating terrain. Height maps and other textures must be authored offline in programs such as [WorldCreator](https://www.world-creator.com/) or [Blender](https://www.blender.org/).

### Demo:

https://three-landscape.vercel.app/

Source code for example is available in the /examples/highland@latest directory

### Installation

`npm install three-landscape`

# Documentation

## TerrainMaterial

Custom material that extends the meshStandardMaterial with additional properties for splat mapping. Splat mapping lets you blend and combine multiple surfaces(grass, rocks, sand etc) into one higher resolution material: http://wiki.polycount.com/wiki/Splat


### Features:

- all the props & behaviors of meshStandardMaterial
- Splatmaps
- Texture saturation and tint
- Stochastic sampling
- Triplanar mapping
- Multiple material blending options

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

### New props:

- splats: Texture[] (expects 4 channel splat data in rgba)
- noise: Texture; used for stochastic sampling
- Surfaces: Surface[];

Most of the new features are configured by modifying surface properties.

### Surfaces:
Surfaces are related groups of textures and properties that define how to render part of the terrain. Rock, grass, sand etc would all be separate surfaces.

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

To get a better understanding of how each noise parameter effects the edge check out this interactive demo: https://www.redblobgames.com/x/1730-terrain-shader-experiments/noisy-hex-rendering.html

Please see the example directory for advanced usage and example textures.

Note: The textures are not covered by the MIT license and should not be used with out first acquiring the rights to do so.

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

## MartiniMesh
Creates a non uniform error minimizing mesh with less geometry than a standard planeBufferGeometry. Acceptable error is measured in world units. Eg error 0 mesh will be nearly identical, a Error 10 mesh will be allowed to differ at most 10 world units at any point from the standard plane. 
```
<mesh>
  <MartiniGeometry displacementMap={displacement} error={10} />
  <meshStandardMaterial color="red" wireframe>
</mesh>
```
[<img width="45%" src="/martini-high.png">](https://three-landscape.vercel.app/)
[<img width="45%" src="/martini-low.png">](https://three-landscape.vercel.app/)


## Roadmap:

Thought it might be fun to let people vote on new feature ideas! If you're interested in a particular feature leave a thumbs up on the associated issue:

[view issues sorted by most votes](https://github.com/nwpointer/three-landscape/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc)


## Contributing:
project is setup using npm workspaces. package includes the library code and examples folder can be used to manually test changes to the library before publishing.

for convenience the following commands are setup in the root of the directory if you're unfamilar with npm workspaces:
```
npm run build
npm run dev
```

npm run dev starts the library and highlands example in watch mode.
the highlands example starts on localhost:5173

### before publishing
```
npm run build
npm publish -w package
```

### testing npm packages
npm link does not work due to the use of peer dependencies. Use pack & install instead

```
~/workspace/package-name $ npm pack
~/workspace/package-name $ cp package-name-0.0.0.tgz ~
~/workspace/some-application $ npm install ~/package-name-0.0.0.tgz
```

## License

MIT License does not apply to any of the image files in the examples directory



