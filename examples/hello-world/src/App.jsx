import { useState } from 'react'
import reactLogo from './assets/react.svg'
import { Canvas } from '@react-three/fiber'
import { Cube } from "three-landscape"

function App() {
  return (
    <div className="App">
      <Canvas>
        <ambientLight />
        <Cube color="blue" />
        <Cube position={[-1, 1, 1]} />
      </Canvas>
    </div>
  )
}

export default App
