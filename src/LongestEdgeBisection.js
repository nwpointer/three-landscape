// plan:
// create a brute force, cpu version of a LES geometry using three.js

// an LES geometry could support some high level criterian for depth
//     < LES criterion = {} />

//     or could just take a BTree and generate the correct geometry ?
//         <LES tree={ } />

// should be able to extend BufferGeometry: https://github.com/mrdoob/three.js/blob/master/src/geometries/PlaneGeometry.js

// would allow the criterion to change, do only one thing well.

// LES technically requires hieght info -> les split and merge should take hightmap into account ?

//     longest edge in triange = vert where both values change

// should allow for dymanic detail to be added 
// on clif faces, points of interest or when viewing surfaces at exterme angles to breakup mips - smearing

// split and merge is simple if no verts reused

// steps:
// extend basic geometry, render a square on screen(sandwich cut)
// display in wireframe

// manually dirive the a cut
// apply texture and normal, make sure there arnn't bugs

// create devide + merge functions




// identify limiting factors:

// create a multi threaded version BC - tree
// create a gpu compute version


