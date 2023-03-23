import { extend } from "@react-three/fiber";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import TerrainMaterial, {TerrainMaterialOptions} from "../three/TerrainMaterial";

export default function(props: TerrainMaterialOptions){
  extend({ TerrainMaterial })

  const material = useRef<TerrainMaterial>(null)
  
  // defines are passed to shaders
  const defines = useMemo(()=>{
    const temp ={} as {[key: string]: string}
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
    ref={material}
    defines={defines}
    key={JSON.stringify({
      distanceOptimized: props.distanceOptimized,
      displacementMap: props.displacementMap,
      // surfaces: props.surfaces
    })} 
  />
}

