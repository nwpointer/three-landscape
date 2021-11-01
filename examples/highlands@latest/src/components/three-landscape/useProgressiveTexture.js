import { useEffect, useState, useRef } from "react";
import { TextureLoader } from "three";

export function useProgressiveTexture(resources) {
  const loader = useRef(new TextureLoader());
  const [i, setI] = useState(0);
  const [texture, setTexture] = useState(new TextureLoader().load(resources[0]));
  useEffect(() => {
    loader.current.load(resources[i], (texture) => {
      setTexture(texture);
      if (i < resources.length - 1) setI(i + 1);
    });
  }, [i]);
  return texture;
}
