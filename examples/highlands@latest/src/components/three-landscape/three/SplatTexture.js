// achieves same affect as splat material but renders to separate normal and diffuse textures with splatting applied
// pro: splatting only computed once
// pro: avoids modifying three.js textures directly
// pro: potentially completely three.js independent
// con: more memory usage?

// https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
// https://gamedevelopment.tutsplus.com/tutorials/quick-tip-how-to-render-to-a-texture-in-threejs--cms-25686
// https://drei.pmnd.rs/?path=/story/misc-usefbo--use-fbo-st