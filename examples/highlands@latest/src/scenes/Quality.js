import { useDetectGPU } from "@react-three/drei";
import React, { useState } from "react";
import { Suspense } from "react";

function QualitySelector() {
  const GPU = useDetectGPU();
  const [quality, setQuality] = useState(
    GPU.isMobile ? 0 : GPU.tier === 3 ? 2 : 1
  );
  return (
    <>
      <h3>visual quality:</h3>
      <div>
        <span
          style={{ padding: "1em", fontWeight: quality == 0 && "bold" }}
          onClick={() => setQuality(0)}
        >
          low
        </span>
        <span
          style={{ padding: "1em", fontWeight: quality == 1 && "bold" }}
          onClick={() => setQuality(1)}
        >
          medium
        </span>
        <span
          style={{ padding: "1em", fontWeight: quality == 2 && "bold" }}
          onClick={() => setQuality(2)}
        >
          high
        </span>
      </div>
    </>
  );
}

export function Scene({}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <Suspense fallback={null}>
        <QualitySelector />
      </Suspense>
    </div>
  );
}
