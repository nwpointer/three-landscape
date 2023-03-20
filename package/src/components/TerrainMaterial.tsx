import { extend } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { MeshStandardMaterialProps } from "@react-three/fiber";
import { biplanar } from "../util/samplers";
import { generateTextureArray } from "../three/generateTextureArray";
import TerrainMaterial from "../three/TerrainMaterial";



/* ----------------------------
TODO:
[+] No more setters for built in props in the material constructor
[+] Constructor perf issues
[+] Don't sample distance texture before its ready
[+] remove macro map computation from base material
[+] blend the near into the distance value
[+] Fix anisotropic filtering prop
[+] Make distance size configurable
[+] apply smoothing to mesh
[+] Fix Triplanar
[+] fix crashing phone when using distance optimized rendering -> was a memory issue
[ ] Use generic loop to generate setters for simple custom props
[ ] Rename samplers to basic samplers
[ ] 1px dydx error between surfaces (most visible with debug textures)
[ ] fix bug where texture encoding is not correct unless distance optimized rendering is enabled
[ ] pass mesh size to material as a parameter

FUN:
[ ] experiment with height based blending
[ ] make smoothness a surface property
[ ] efficient terrain scale parallax
[ ] experiment with alts to triplanar
[ ] productionalize hexagonal grid
[ ] productionalize macro map
[ ] clean up for launch!
[ ] figure out how to optimally update all parameters
----------------------------- */

export type Surface = {
  diffuse?: THREE.Texture;
  normal?: THREE.Texture;
  normalStrength?: Number;
  flipNormals?: boolean;
  repeat?: Number;
  saturation?: Number;
  tint?: THREE.Vector4;
  triplanar?: boolean;
  gridless?: boolean;
  aperiodic?: boolean;
  displacement?: THREE.Texture;
  displacementScale?: number;
};

export type TerrainMaterialOptions = MeshStandardMaterialProps & {
  surfaces: Surface[];
  splats: THREE.Texture[];
  noise?: THREE.Texture;
  anisotropy?: number | "max";
  smoothness?: number;
  surfaceSamples?: number;
  macroMap?: THREE.Texture;
  distanceOptimized?: boolean;
  far: number;
  weights?: THREE.Texture;
  indexes?: THREE.Texture;
  applyDefaultEncoding?: boolean;
  distanceTextureScale?: number;
};

export default function(props: TerrainMaterialOptions){
  extend({ TerrainMaterial })
  
  // defines are passed to shaders
  const defines = useMemo(()=>{
    const temp ={} as {[key: string]: string}
    // if(props.normalMap) temp.USE_NORMALMAP = 'true';
    if(props.smoothness) temp.USE_SMOOTHNESS = 'true';
    if(props.distanceOptimized) temp.USE_FARMAPS = 'true';
    if(props.macroMap) temp.USE_MACRO = 'true';
    if(props.weights && props.indexes) temp.USE_WEIGHTS_AND_INDEXES = 'true';
    return temp;
  }, [props.normalMap, props.smoothness, props.distanceOptimized, props.macroMap])

  //prevents constructor from running on prop changes, key is used to trigger reconstruction
  const args = useMemo(()=>{
    return [{...props}]
  }, [
    ...(props.surfaces.map(s=>s.aperiodic)),
    ...(props.surfaces.map(s=>s.triplanar)),
  ])

  // TODO: grab a ref to the mesh and pass its size to the material

  //@ts-ignore
  return <terrainMaterial
    {...props}
    args={args}
    defines={defines}
    key={JSON.stringify({
      distanceOptimized: props.distanceOptimized,
      displacementMap: props.displacementMap,
      // surfaces: props.surfaces
    })} 
  />
}

