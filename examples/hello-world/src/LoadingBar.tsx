import {
  useProgress,
  Html
} from "@react-three/drei";

export function LoadingBar() {
  const state = useProgress();

  return (
    <Html center>
      <div
        style={{ border: "1px solid white", height: "10px", width: "100px" }}
      >
        <div
          style={{
            background: "white",
            height: "10px",
            width: `${state.progress}px`,
          }} />
      </div>
    </Html>
  );
}
