import { MeshStandardMaterial } from 'three';
import * as THREE from 'three'
import CustomShaderMaterial, { iCSMUpdateParams } from "three-custom-shader-material/vanilla";

export function shaderMaterial(
  uniforms: {
    [name: string]:
      | THREE.CubeTexture
      | THREE.Texture
      | Int32Array
      | Float32Array
      | THREE.Matrix4
      | THREE.Matrix3
      | THREE.Quaternion
      | THREE.Vector4
      | THREE.Vector3
      | THREE.Vector2
      | THREE.Color
      | number
      | boolean
      | Array<any>
      | null
  },
  vertexShader: string,
  fragmentShader: string,
  baseMaterial = MeshStandardMaterial,
  onInit?: (material?: CustomShaderMaterial) => void
) {
  const material = class extends CustomShaderMaterial {
    public key: string = ''
    constructor(parameters = {}, ...rest) {
      console.log(parameters, rest);
        
      const entries = Object.entries(uniforms)
      // Create unforms and shaders
      // @ts-ignore
      super({
        uniforms: entries.reduce((acc, [name, value]) => {
          const uniform = THREE.UniformsUtils.clone({ [name]: { value } })
          return {
            ...acc,
            ...uniform,
          }
        }, {}),
        baseMaterial,
        vertexShader,
        fragmentShader,
      })
      // Create getter/setters
      entries.forEach(([name]) =>
        Object.defineProperty(this, name, {
          get: () => this.uniforms[name].value,
          set: (v) => (this.uniforms[name].value = v),
        })
      )

      // Assign parameters, this might include uniforms
      Object.assign(this, parameters)
      // Call onInit
      if (onInit) onInit(this)
    }
  } as unknown as typeof THREE.ShaderMaterial & { key: string }
  material.key = THREE.MathUtils.generateUUID()
  return material
}