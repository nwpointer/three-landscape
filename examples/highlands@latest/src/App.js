import logo from './logo.svg'
import React, { useEffect, useState } from 'react'
import { extend } from '@react-three/fiber'
import './ColorShiftMaterial.js'
// import { Scene } from "./scenes/CustomMaterial";
// import { Scene } from "./scenes/LOD";
// import { Scene } from "./scenes/Progressive";
// import { Scene } from "./scenes/Basis";
// import { Scene } from "./scenes/Quality";
import { Scene } from './scenes/SplatMaterial'
import { Html } from '@react-three/drei'

function App() {
  const [quality, setQuality] = useState() // 0=low 1=med 2=high

  return <Scene />
}

export default App
