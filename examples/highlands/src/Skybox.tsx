import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react';
import { BackSide, TextureLoader } from 'three'

export function Skybox({ fog=false, path = '/DayInTheClouds4k.jpg', rotation = [0, -Math.PI / 2, 0] }) {
  const map = useLoader(TextureLoader, path)
  const { camera } = useThree();

  const mesh = useRef();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.copy(camera.position);
    }
  });
  
  
  
  return (
    // @ts-expect-error
    <mesh rotation={rotation} ref={mesh}>
      <sphereBufferGeometry args={[1000, 300, 300]} />
      <meshBasicMaterial fog={fog} map={map} side={BackSide} />
    </mesh>
  )
}