import { useLoader } from '@react-three/fiber'
import { BackSide, TextureLoader } from 'three'

export function Skybox({ fog, path = '/DayInTheClouds4k.jpg', rotation = [0, Math.PI / 2, 0] }) {
  const map = useLoader(TextureLoader, path)
  return (
    <mesh rotation={rotation}>
      <sphereBufferGeometry args={[2000, 300, 300]} />
      <meshBasicMaterial fog={fog} map={map} side={BackSide} />
    </mesh>
  )
}
