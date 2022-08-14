const grass = {
normal: img,
albedo: img,
displacement: img,
triaplanar: true | false,
scale: [x],
tilingMethod: {
type: grid | smoothVoronoi | smoothhex,
args: {}
},
edge: hard | blend | stocastic
}

<TerrainMaterial
displacementMap
displacementScale
displacementBias
splatTextureModeMode="rgab|bw"
interpolateHights
normalMap={img}
splats={[a,b]}
splatTextureMode="rgab|bw"
materials={[grass,moss,dirt,mud,rocks]}

>

<!-- should be able to integrate dynamic mesh with physics system -->

F1
TerrainMaterial, extends standard material + supports just splatting
materials = {albedo,scale}
scale
splat color modes

material normals
Tiling method: smoothVoronoi
material displacement

# research

https://hhoppe.com/geomclipmap.pdf
(render hd near camera)
restricted quadtree triagulation
(render hd arround complex details like clifs
https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.69.7733&rep=rep1&type=pdf)

concurent binary tree:
(subdivide where it maters)
https://onrendering.com/data/papers/cbt/ConcurrentBinaryTrees.pdf
avoids t-juctions to so no cracks in the terrain

need higher quality tile textures
should be able to get away with lower quality splat if they are procedurally blended instead of just a straight linear gradient

## Realistic atmospheric scattering

https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@6.5/manual/Atmospheric-Scattering.html

https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering

https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/simulating-sky/simulating-colors-of-the-sky
