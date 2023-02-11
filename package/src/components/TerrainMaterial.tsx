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
    material.surfaceLimit = props.surfaceLimit;
    material.surfaces = props.surfaces;
    material.useMacro = props.useMacro;

  }, [props.anisotropy, props.smoothness, props.surfaceLimit, props.surfaces, props.useMacro]);

  return <primitive object={material} attach="material" />;
}
