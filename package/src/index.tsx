import React from "react";
import "@react-three/fiber";
import TerrainMaterial from "./components/TerrainMaterial";

export function Cube(params: {
  // color: string;
  position: [number, number, number];
}) {
  return (
    <mesh position={params.position || [1, 0, 0]}>
      <boxGeometry />
      {/* <meshStandardMaterial color={params.color || "red"} /> */}
      <TerrainMaterial />
    </mesh>
  );
}
