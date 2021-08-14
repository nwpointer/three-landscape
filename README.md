# Three landscape

A react-three-fiber component for rendering high quality 3d landscapes. If you prefer to use vanilla three.js you can also just use the custom material on its own.

<img src="/thumbnail.png">

features include:

- hightmap support
- splatmaps based texture blending
- texture repetition hiding
- multi level normal blending for increased detail

todo:

- tri-planar projection to lessen texture stretching on vertical surfaces
- use higher quality terrain assets near camera.

## Demo:

https://three-landscape.vercel.app/

## Installation

`npm install three-landscape`

## Usage

The terrain component extends three.meshStandardMaterial so all the parameters you would normally pass to the standard material can also be passed to the Terrain component.

By default the size of the terrain is equal to 1 world unit per pixel in the hight map.

There are a couple of new parameters including splats, tiles and layers which are the primary way of interacting with the additional terrain specific features of the component.

This example is taken from the examples directory:

```javascript
<Terrain
  envMapIntensity={0.5}
  metalness={1}
  displacement={`${root}/heightmap.jpg`}
  displacementScale={100}
  displacementBias={-60}
  normalScale={new THREE.Vector2(1.5, 2)}
  normal={`${root}/normalmap-y-hd.jpg`}
  splats={[`${root}/splatmap_00.tga`, `${root}/splatmap_01.tga`]}
  tiles={[
    {
      diffuse: `${root}/Assets/Cliffs_02/Rock_DarkCrackyCliffs_col.png`,
      normal: `${root}/Assets/Cliffs_02/Rock_DarkCrackyCliffs_norm.png`
    },
    {
      diffuse: `${root}/Assets/Rock_04/Rock_sobermanRockWall_col.png`,
      normal: `${root}/Assets/Rock_04/Rock_sobermanRockWall_norm.png`
    },
    {
      diffuse: `${root}/Assets/Mud_03/Ground_WetBumpyMud_col.png`,
      normal: `${root}/Assets/Mud_03/Ground_WetBumpyMud_norm.png`
    },
    {
      diffuse: `${root}/Assets/Grass_020/ground_Grass1_col.png`
    }
  ]}
  layers={[
    {
      diffuse: { tile: 0, repeat: [23.5252656529, 23.5252656529] },
      normal: { tile: 0, repeat: [23.5252656529, 23.5252656529], splat: 1, weight: 0.5 }
    },
    {
      diffuse: { tile: 1, repeat: [21.7732806125, 21.7732806125] },
      normal: { tile: 1, repeat: [256, 256], weight: 0.5 }
    },
    {
      diffuse: { tile: 2, repeat: [256, 256] },
      normal: { tile: 2, repeat: [256, 256] }
    },
    {
      diffuse: { tile: 3, repeat: [256, 256], saturation: 1.1 }
    },
    {
      diffuse: { tile: 3, repeat: [256, 256], saturation: 1.25 }
    },
    {
      diffuse: { tile: 2, repeat: [256, 256] },
      normal: { tile: 2, repeat: [256, 256], weight: 0.5 }
    }
  ]}
/>
```

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Please Lint and test your code before submitting.

## License

MIT License does not apply to any of the image files in the examples directory
