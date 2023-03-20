import { extend } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo } from "react";
import { MeshStandardMaterialProps } from "@react-three/fiber";
import TerrainMaterial from "../three/TerrainMaterial";

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

