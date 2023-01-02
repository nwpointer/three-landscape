import { useThree } from "@react-three/fiber";
import { OrthographicCamera, Hud } from "@react-three/drei";

import React from "react";

export function Preview({
  scale = 4,
  renderPriority = 1,
  children,
  width,
  height,
  corner = [1, -1],
  padding = [60, 60],
}: {
  scale?: number;
  renderPriority?: number;
  width?: number;
  children?: any;
  height?: number;
  corner?: [number, number];
  padding?: [number, number];
}) {
  const { size } = useThree();
  const [w, h] = [width || size.width / scale, height || size.height / scale];

  return (
    <Hud renderPriority={renderPriority}>
      <OrthographicCamera makeDefault position={[0, 2, 2]} />
      <mesh
        position={[
          (corner[0] * (size.width - w - padding[0] * 2)) / 2,
          (corner[1] * (size.height - h - padding[1] * 2)) / 2,
          0,
        ]}
      >
        <planeBufferGeometry args={[w, h]} />
        <meshBasicMaterial color="white">{children}</meshBasicMaterial>
      </mesh>
    </Hud>
  );
}
