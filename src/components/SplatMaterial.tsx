import React from "react";
import { RepeatWrapping } from "three";
import SplatStandardMaterialImpl from '../three/SplatMaterial'

export const SplatStandardMaterial = React.forwardRef((props, ref) => {
  const [material] = React.useState(() => new SplatStandardMaterialImpl(props));

  // @ts-expect-errors
  const { diffuseMaps, normalMaps } = props;

  [...diffuseMaps, ...normalMaps].forEach(t => {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  })

  return <primitive dispose={undefined} object={material} ref={ref} attach="material" {...props} />;
});

