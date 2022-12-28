export default function TerrainMesh({children, ...props}){
    return <mesh {...props}>
        {children}
    </mesh>
}