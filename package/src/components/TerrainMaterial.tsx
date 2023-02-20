import React, { useEffect, useState, useMemo } from "react";
import TerrainMaterial, { TerrainMaterialOptions } from "../three/TerrainMaterial";
import { useThree } from "@react-three/fiber";


export default function (props: TerrainMaterialOptions) {
  const { gl } = useThree();

  const material = useMemo(
    () => new TerrainMaterial({ ...props }, gl),
    []
  );
  useEffect(() => {
    material.setValues(props);
  }, [props]);

  useEffect(() => {
    material.anisotropy = props.anisotropy;
    material.smoothness = props.smoothness;
    material.activeSurfaces = props.activeSurfaces;
    material.surfaces = props.surfaces;
    material.useMacro = props.useMacro;
    material.useDistanceOptimizedRendering = props.useDistanceOptimizedRendering;
    material.surfaces = props.surfaces;

  }, [props.anisotropy, props.smoothness, props.activeSurfaces, props.surfaces, props.useMacro, props.useDistanceOptimizedRendering, props.surfaces]);

  return <primitive object={material} attach="material" />;
}
