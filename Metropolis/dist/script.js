'use strict';

//---

console.clear();

//---

let w = 0;
let h = 0;
let initialWidth = w;
let initialHeight = h;

let animationFrame = null;
let isTouchDevice = false;

const fov = 600;

const lightVector = { x: -fov * 0.25, y: 0, z: -fov * 0.5 };
const cameraVector = { x: 0, y: 0, z: -fov };

const canvas = document.createElement( 'canvas' );
const gl = canvas.getContext( 'webgl2' ) || canvas.getContext( 'experimental-webgl2' );

const center = { x: w / 2, y: h / 2 };
const border = { left: 1, top: 1, right: w, bottom: h };
const borderDistance = 0;

const pointerDistance = 25;
let pointer = { x: 0, y: 0 };
let pointerInitialPos = { x: 0, y: 0};
let pointerPos = { x: center.x, y: center.y };
let pointerDownButton = -1;
let pointerActive = false;

//---

let shaderProgram = null;

let webgl_vertices = [];
let webgl_faces = [];
let webgl_uvs = [];
let webgl_layers = [];

const buffers = {};

//---

const vertexCode = `#version 300 es

    in vec2 a_position;
    in vec2 a_texcoord;
    in float a_layer;

    uniform vec2 u_resolution;

    out vec2 v_texcoord;
    out float v_layer;

    void main(void) {

        v_texcoord = a_texcoord;
        v_layer = a_layer;

        vec2 pos2d = a_position.xy;
        vec2 zeroToOne = pos2d / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;

        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

    }
    
`;

const fragmentCode = `#version 300 es

    precision lowp float;
    precision lowp sampler2DArray;

    in vec2 v_texcoord;
    in float v_layer;

    uniform sampler2DArray u_textureArray;

    out vec4 fragColor;

    void main(void) {

        fragColor = texture(u_textureArray, vec3(v_texcoord, v_layer));

    }
    
`;

//---

let gridTileSize = 0;
let gridTileSizeHalf = 0;
let gridStartPositionX = 0;
let gridStartPositionY = 0;
let gridEndPositionX = 0;
let gridEndPositionY = 0;
let gridDotsPerRow = 0;
let gridDotsPerColumn = 0;
let gridWidth = 0;
let gridHeight = 0;
let gridMaxTileSize = 4;
let gridBuildingTileSizes = [ { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 1, y: 3 }, { x: 3, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 } ];
let gridStreetTileTypes = [ 'empty', '1x1_vertical', '1x1_horizontal', '1x1_crossing', '2x1l_vertical', '2x1r_vertical', '1x2t_horizontal', '1x2b_horizontal', '1x2r_crossing', '1x2l_crossing', '2x1t_crossing', '2x1b_crossing', '2x2tl_crossing', '2x2tr_crossing', '2x2bl_crossing', '2x2br_crossing', '1x1l_horizontal_crosswalk', '1x1r_horizontal_crosswalk', '1x1b_vertical_crosswalk', '1x1t_vertical_crosswalk', '1x2lt_horizontal_crosswalk', '1x2lb_horizontal_crosswalk', '1x2rt_horizontal_crosswalk', '1x2rb_horizontal_crosswalk', '2x1tl_vertical_crosswalk', '2x1tr_vertical_crosswalk', '2x1bl_vertical_crosswalk', '2x1br_vertical_crosswalk' ];
let gridTileHolder = [];
let gridCubeHolder = [];
let gridStreetHolder = [];
let gridMovementSaveXPos = 0;
let gridMovementSaveYPos = 0;

const dotsRadius = 1;
const dotsDistance = 10;
const dotsDiameter = dotsRadius * 2;
let dotsHolder = [];

let streetsCountVertical = 0;
let streetsCountHorizontal = 0;

let debugBorderElement = null;
let debugBorderElementColor = 'transparent';

//---

const texturesBuildingsCount = 64;
const textureWidth = 64;
const textureHeight = 64;

let textureHolder = [];
let promiseHolder = [];
let textureAtlas = {};
let textureArray = null;
let texture = null;
const texturesBuildingRoofsTiles = 9;
let texturesCountBuildingRoofs = 0;
let texturesCountBuildingWalls = 0;
let texturesCountStreets = 0;

const textureCubeNormals = [

    { x: 0, y: 0, z: -1 }, // front
    { x: -1, y: 0, z: 0 }, // left
    { x: 0, y: -1, z: 0 }, // top
    { x: 1, y: 0, z: 0 },  // right
    { x: 0, y: 1, z: 0 },  // bottom

];

const textureBuildingColors = [

    { cWa: { r: 254, g: 236, b: 214 }, cWi: { r: 67, g: 49, b: 37 } },
    { cWa: { r: 244, g: 250, b: 240 }, cWi: { r: 13, g: 39, b: 52 } },
    { cWa: { r: 244, g: 250, b: 240 }, cWi: { r: 26, g: 36, b: 48 } },
    { cWa: { r: 228, g: 231, b: 222 }, cWi: { r: 73, g: 79, b: 79 } },
    { cWa: { r: 228, g: 231, b: 222 }, cWi: { r: 103, g: 93, b: 94 } },
    { cWa: { r: 184, g: 187, b: 196 }, cWi: { r: 38, g: 56, b: 66 } },
    { cWa: { r: 219, g: 226, b: 230 }, cWi: { r: 32, g: 45, b: 54 } },
    { cWa: { r: 249, g: 244, b: 225 }, cWi: { r: 63, g: 53, b: 61 } },
    { cWa: { r: 240, g: 243, b: 234 }, cWi: { r: 19, g: 36, b: 46 } },
    { cWa: { r: 255, g: 255, b: 255 }, cWi: { r: 22, g: 34, b: 40 } },
    { cWa: { r: 230, g: 214, b: 201 }, cWi: { r: 63, g: 68, b: 74 } },
    { cWa: { r: 213, g: 212, b: 202 }, cWi: { r: 59, g: 75, b: 72 } },
    { cWa: { r: 243, g: 237, b: 237 }, cWi: { r: 94, g: 92, b: 81 } },
    { cWa: { r: 228, g: 228, b: 203 }, cWi: { r: 63, g: 52, b: 44 } },
    { cWa: { r: 233, g: 222, b: 216 }, cWi: { r: 39, g: 46, b: 54 } },
    { cWa: { r: 238, g: 219, b: 192 }, cWi: { r: 77, g: 87, b: 88 } },
    { cWa: { r: 238, g: 230, b: 225 }, cWi: { r: 55, g: 71, b: 84 } },
    { cWa: { r: 239, g: 211, b: 196 }, cWi: { r: 95, g: 87, b: 85 } },
    { cWa: { r: 243, g: 242, b: 238 }, cWi: { r: 32, g: 42, b: 51 } },
    { cWa: { r: 243, g: 233, b: 223 }, cWi: { r: 61, g: 72, b: 74 } },
    { cWa: { r: 230, g: 228, b: 225 }, cWi: { r: 30, g: 47, b: 55 } },
    { cWa: { r: 218, g: 226, b: 230 }, cWi: { r: 15, g: 29, b: 38 } },
    { cWa: { r: 244, g: 238, b: 224 }, cWi: { r: 99, g: 92, b: 89 } },
    { cWa: { r: 242, g: 219, b: 191 }, cWi: { r: 120, g: 111, b: 73 } },
    { cWa: { r: 233, g: 239, b: 245 }, cWi: { r: 80, g: 82, b: 91 } },
    { cWa: { r: 237, g: 225, b: 211 }, cWi: { r: 47, g: 40, b: 32 } },
    { cWa: { r: 211, g: 207, b: 198 }, cWi: { r: 55, g: 46, b: 39 } },
    { cWa: { r: 223, g: 222, b: 213 }, cWi: { r: 41, g: 41, b: 39 } },

];

//---

function init() {

    gl.enable( gl.SCISSOR_TEST );

    shaderProgram = createShaderProgram( gl, vertexCode, fragmentCode );

    //---

    isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

    if ( isTouchDevice === true ) {

        canvas.addEventListener( 'touchmove', cursorMoveHandler, false );
        canvas.addEventListener( 'touchend', cursorLeaveHandler, false );
        canvas.addEventListener( 'touchcancel ', cursorLeaveHandler, false );

    } else {

        canvas.addEventListener( 'pointermove', cursorMoveHandler, false );
        canvas.addEventListener( 'pointerdown', cursorDownHandler, false );
        canvas.addEventListener( 'pointerup', cursorUpHandler, false );
        canvas.addEventListener( 'pointerleave', cursorLeaveHandler, false );

    }

    //---

    document.body.appendChild( canvas );

    //---

    debugBorderElement = document.createElement( 'div' );

    debugBorderElement.style.border = '1px solid ' + debugBorderElementColor;
    debugBorderElement.style.position = 'absolute';
    debugBorderElement.style.margin = 'auto';
    debugBorderElement.style.pointerEvents = 'none';
    
    document.body.appendChild( debugBorderElement );

    //---

    createTextures().then( () => {

        window.addEventListener( 'resize', onResize, false );

        restart();

    } );

}

function onResize( event ) {
    
    restart();

}

function restart() {

    const innerWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const innerHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

    //---

    w = innerWidth;
    h = innerHeight;

    //---

    canvas.width = w;
    canvas.height = h;

    gl.viewport( 0, 0, w, h );

    //---
    
    center.x = w / 2;
    center.y = h / 2;
    
    pointerPos.x = center.x;
    pointerPos.y = center.y;

    pointer.x = center.x + pointerDistance;
    pointer.y = center.y - pointerDistance;
    pointerInitialPos.x = center.x + pointerDistance;
    pointerInitialPos.y = center.y - pointerDistance;
    
    //---

    border.left = borderDistance;
    border.top = borderDistance;
    border.right = w - borderDistance;
    border.bottom = h - borderDistance;

    console.log( 'border: ', border, w, h );

    //---

    debugBorderElement.style.left = borderDistance + 'px';
    debugBorderElement.style.right = borderDistance + 'px';
    debugBorderElement.style.top = borderDistance + 'px';
    debugBorderElement.style.bottom = borderDistance + 'px';

    //---

    gl.scissor( border.left, border.top, border.right - border.left, border.bottom - border.top );

    buffers.positionAttributeLocation = gl.getAttribLocation( shaderProgram, 'a_position' );
    buffers.texcoordAttributeLocation = gl.getAttribLocation( shaderProgram, 'a_texcoord' );
    buffers.resolutionUniformLocation = gl.getUniformLocation( shaderProgram, 'u_resolution' );
    buffers.layerAttributeLocation = gl.getAttribLocation( shaderProgram, 'a_layer' );
    
    gl.enableVertexAttribArray( buffers.positionAttributeLocation );
    gl.enableVertexAttribArray( buffers.texcoordAttributeLocation );
    gl.enableVertexAttribArray( buffers.layerAttributeLocation );

    gl.vertexAttribPointer( buffers.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0 );
    gl.vertexAttribPointer( buffers.texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0 );
    gl.vertexAttribPointer( buffers.layerAttributeLocation, 1, gl.FLOAT, false, 0, 0 );

    gl.uniform2f( buffers.resolutionUniformLocation, w, h );

    //---

    gridTileHolder = [];
    gridCubeHolder = [];
    gridStreetHolder = [];

    webgl_vertices = [];
    webgl_faces = [];
    webgl_uvs = [];
    webgl_layers = [];

    textureHolder = [];
    promiseHolder = [];

    //---

    removeGrid();
    addGrid();

    //---
    
    if ( animationFrame != null ) {
    
        cancelAnimFrame( animationFrame );
    
    }
    
    render();

}

//---

function createTextures() {

    return new Promise( async ( resolve, reject ) => {

        texturesCountBuildingRoofs = 0;

        for ( let i = 0; i < texturesBuildingsCount; i++ ) {

            const color = addColorVariance( textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ].cWa, 2 );
            const colorWall = calcFaceNormalColor( color, textureCubeNormals[ 0 ] );

            const textureRowsAndCols = Math.sqrt( texturesBuildingRoofsTiles )
            const textures = createRoofTexture( 0, colorWall, textureWidth, textureHeight, textureRowsAndCols, textureRowsAndCols );

            for ( let j = 0; j < texturesBuildingRoofsTiles; j++ ) {

                const texture = textures[ j ];

                textureHolder.push( texture.image );
                promiseHolder.push( texture.promise );

                texturesCountBuildingRoofs++;

            }

        }

        //---

        texturesCountBuildingWalls = 0;

        const wallTexturesCount = Math.floor( texturesBuildingsCount / 6 );

        const createWalls = ( tP, cWa, cWi, wR, rX, rY, p ) => {

            for ( let i = 1, l = textureCubeNormals.length; i < l; i++ ) {

                const cubeNormal = textureCubeNormals[ i ];
                const colorWall = calcFaceNormalColor( cWa, cubeNormal );
                const colorWindows = calcFaceNormalColor( cWi, cubeNormal );

                const texture = createWallTexture( tP, colorWall, colorWindows, wR, rX, rY, p, textureWidth, textureHeight );

                textureHolder.push( texture.image );
                promiseHolder.push( texture.promise );

                texturesCountBuildingWalls++;

            }

        };

        for ( let i = 0; i < wallTexturesCount * 0.5; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = Math.random() * 0.3 + 0.1;
            const repeatX = 1;
            const repeatY = Math.floor( Math.random() * 1 ) + 3;
            const padding = 0;

            createWalls( 0, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount * 0.5; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = Math.random() * 0.5 + 0.15;
            const repeatX = Math.floor( Math.random() * 1 ) + 4;
            const repeatY = 1;
            const padding = 0;

            createWalls( 1, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = Math.random() * 0.5 + 0.25;
            const repeatX = Math.floor( Math.random() * 3 ) + 2;
            const repeatY = Math.floor( Math.random() * 2 ) + 3;
            const padding = ( repeatX + repeatY ) * ( Math.random() * 0.25 + 0.5 );

            createWalls( 2, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount * 0.5; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = 1;
            const repeatX = Math.floor( Math.random() * 2 ) + 1;
            const repeatY = repeatX === 1 ? 3 : Math.floor( Math.random() * 2 ) + 1;
            const padding = 1;

            createWalls( 3, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount * 0.5; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = 1;
            const repeatX = Math.round( Math.random() * 1 ) + 1;
            const repeatY = repeatX === 2 ? Math.floor( Math.random() * 1 ) + 3 : Math.floor( Math.random() * 1 ) + 1;
            const padding = Math.random() * 0.5;

            createWalls( 4, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount * 0.5; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = 1;
            const repeatX = 2;
            const repeatY = Math.round( Math.random() * 2 ) + 1;
            const padding = Math.floor( Math.random() * 4 ) + 6;

            createWalls( 4, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = 1;
            const repeatX = Math.round( Math.random() * 2 ) + 2;
            const repeatY = repeatX === 2 ? 3 : Math.round( Math.random() * 1 ) + 2;
            const padding = 1;

            createWalls( 5, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = 1;
            const repeatX = 2;
            const repeatY = Math.round( Math.random() * 2 ) + 1;
            const padding = Math.floor( Math.random() * 4 ) + 6;

            createWalls( 6, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        for ( let i = 0; i < wallTexturesCount * 0.5; i++ ) {

            const colors = textureBuildingColors[ Math.floor( Math.random() * textureBuildingColors.length ) ];
            const cWa = addColorVariance( colors.cWa, 3 );
            const cWi = addColorVariance( colors.cWi, 3 );
            const windowRatio = 1;
            const repeatX = Math.floor( Math.random() * 1 ) + 1;
            const repeatY = repeatX * 0.5;
            const padding = Math.random() * 0.3 + 0.2;

            createWalls( 7, cWa, cWi, windowRatio, repeatX, repeatY, padding );

        }

        //---

        texturesCountStreets = 0;

        for ( let i = 0; i < gridStreetTileTypes.length; i++ ) {

            const streetTileType = gridStreetTileTypes[ i ];

            let texture = createStreetTexture( streetTileType, textureWidth, textureHeight );

            textureHolder.push( texture.image );
            promiseHolder.push( texture.promise );

            texturesCountStreets++;

        }

        //---

        await Promise.all( promiseHolder );

        //---

        textureArray = createTextureArray( gl, textureWidth, textureHeight, textureHolder.length );

        for ( let i = 0; i < textureHolder.length; i++ ) {

            const texture = textureHolder[ i ];

            loadTextureIntoArray( gl, textureArray, i, texture, textureWidth, textureHeight );

        }

        gl.generateMipmap( gl.TEXTURE_2D_ARRAY );

        //---

        resolve();

    } );

}

//---

function addGrid() {

    gridTileSize = dotsDiameter + dotsDistance;
    gridTileSizeHalf = gridTileSize * 0.5;

    gridDotsPerRow = Math.ceil( ( border.right - border.left ) / gridTileSize ) + ( gridMaxTileSize * 2 );
    gridDotsPerColumn = Math.ceil( ( border.bottom - border.top ) / gridTileSize ) + ( gridMaxTileSize * 2 );

    gridWidth = gridDotsPerRow * gridTileSize;
    gridHeight = gridDotsPerColumn * gridTileSize;

    gridStartPositionX = gridWidth * -0.5;
    gridStartPositionY = gridHeight * -0.5;
    gridEndPositionX = gridStartPositionX + gridWidth;
    gridEndPositionY = gridStartPositionY + gridHeight;

    //---

    const streetsH = Math.floor( gridDotsPerRow / 10 );
    const streetsV = Math.floor( gridDotsPerColumn / 10 );

    streetsCountHorizontal = Math.floor( Math.random() * ( streetsH * 0.75 ) + streetsH * 0.5 ) + 1;
    streetsCountVertical = Math.floor( Math.random() * ( streetsV * 0.75 ) + streetsV * 0.5 ) + 1;

    const streetRows = getRandomUniqueIndices( gridDotsPerRow, streetsCountHorizontal );
    const streetColumns = getRandomUniqueIndices( gridDotsPerColumn, streetsCountVertical );

    //---

    for ( let i = 0; i < gridDotsPerColumn; i++ ) {

        for ( let j = 0; j < gridDotsPerRow; j++ ) {

            const x = gridStartPositionX + j * ( dotsDistance + dotsDiameter );
            const y = gridStartPositionY + i * ( dotsDistance + dotsDiameter );

            const rowIndex = j;
            const colIndex = i;

            const dot = addDot( x, y, rowIndex, colIndex );

            dotsHolder.push( dot );

        }

    }

    //---

    for ( let i = 0; i < gridDotsPerColumn; i++ ) {

        for ( let j = 0; j < gridDotsPerRow; j++ ) {

            const index = i * gridDotsPerRow + j;

            const dot = dotsHolder[ index ];

            const neighborRightIndex = ( j + 1 ) % gridDotsPerRow + i * gridDotsPerRow;
            const neighborBottomIndex = ( ( i + 1 ) % gridDotsPerColumn ) * gridDotsPerRow + j;
            const neighborRightBottomIndex = ( ( i + 1 ) % gridDotsPerColumn ) * gridDotsPerRow + ( j + 1 ) % gridDotsPerRow;
            const neighborLeftIndex = ( j - 1 + gridDotsPerRow ) % gridDotsPerRow + i * gridDotsPerRow;
            const neighborTopIndex = ( ( i - 1 + gridDotsPerColumn ) % gridDotsPerColumn ) * gridDotsPerRow + j;

            dot.neighborRight = dotsHolder[ neighborRightIndex ];
            dot.neighborBottom = dotsHolder[ neighborBottomIndex ];
            dot.neighborRightBottom = dotsHolder[ neighborRightBottomIndex ];
            dot.neighborLeft = dotsHolder[ neighborLeftIndex ];
            dot.neighborTop = dotsHolder[ neighborTopIndex ];

        }

    }

    //---

    for ( let i = 0; i < gridDotsPerColumn; i++ ) {

        for ( let j = 0; j < gridDotsPerRow; j++ ) {

            const dot = dotsHolder[ i * gridDotsPerRow + j ];

            if ( streetColumns.includes( i ) || streetRows.includes( j ) ) {

                dot.isStreet = true;
                dot.inUse = true;

            }

        }

    }

    for ( let i = 0; i < dotsHolder.length; i++ ) {

        const dot = dotsHolder[ i ];

        if ( dot.isStreet === true ) {

            addTile( [ dot ], 1, 1, 'street' );

        }

    }

    //---

    let buildingCounter = 0;
    let buildingHolder = [];

    //---

    for ( let i = 0; i < gridBuildingTileSizes.length; i++ ) {

        const gridBuildingTileSize = gridBuildingTileSizes[ i ];

        if ( i < gridBuildingTileSizes.length - 1 ) {

            const randomBuildingCountPreset = Math.floor( ( gridDotsPerRow * gridDotsPerColumn ) / ( gridBuildingTileSizes.length - i ) );
            const randomBuildingCount = randomBuildingCountPreset * ( ( ( i + 1 ) * 0.5 ) * ( ( gridBuildingTileSizes.length * 0.5 ) / 100 ) );

            const dotsHolderIndicesHolder = Array.from( { length: dotsHolder.length }, ( v, k ) => k );
            const dotsHolderRandomIndicesHolder = arrayShuffle( dotsHolderIndicesHolder ).slice( 0, randomBuildingCount );

            for ( let j = 0, l = dotsHolderRandomIndicesHolder.length; j < l; j++ ) {

                const dot = dotsHolder[ dotsHolderRandomIndicesHolder[ j ] ];

                if ( areDotsAvailable( dot, gridBuildingTileSize.x, gridBuildingTileSize.y ) === true ) {

                    buildingCounter++;
    
                    dot.inUse = true;
                    dot.cubeIndex = buildingCounter;
                    dot.depth = calcTileDepth( gridBuildingTileSize.x, gridBuildingTileSize.y );
    
                    const gridTileDots = setDotsInUse( dot, gridBuildingTileSize.x, gridBuildingTileSize.y, buildingCounter, dot.depth );

                    buildingHolder.push( { dots: gridTileDots, width: gridBuildingTileSize.x, height: gridBuildingTileSize.y, depth: dot.depth } );

                }

            }

        } else {

            for ( let j = 0, l = dotsHolder.length; j < l; j++ ) {

                const dot = dotsHolder[ j ];

                if ( dot.inUse === false ) {

                    buildingCounter++;

                    dot.inUse = true;
                    dot.cubeIndex = buildingCounter;
                    dot.depth = calcTileDepth( 1, 1 );

                    buildingHolder.push( { dots: [ dot ], width: 1, height: 1, depth: dot.depth } );

                }

            }

        }

    }

    for ( let i = 0; i < buildingHolder.length; i++ ) {

        const building = buildingHolder[ i ];

        addTile( building.dots, building.width, building.height, 'building', building.depth );

    }

    //---

    sortCubes();

}

function areDotsAvailable( dot, width, height ) {

    const rowIndex = dot.rowIndex;
    const colIndex = dot.colIndex;

    for ( let i = 0; i < height; i++ ) {

        for ( let j = 0; j < width; j++ ) {

            const neighborRowIndex = ( colIndex + i ) % gridDotsPerColumn;
            const neighborColIndex = ( rowIndex + j ) % gridDotsPerRow;
            const neighborIndex = neighborRowIndex * gridDotsPerRow + neighborColIndex;

            if ( dotsHolder[ neighborIndex ].inUse === true ) {

                return false;

            }

        }

    }

    return true;

}

function setDotsInUse( dot, width, height, buildingIndex, depth ) {

    const rowIndex = dot.rowIndex;
    const colIndex = dot.colIndex;

    const dotsInUse = [];

    for ( let i = 0; i < height; i++ ) {

        for ( let j = 0; j < width; j++ ) {

            const neighborRowIndex = ( colIndex + i ) % gridDotsPerColumn;
            const neighborColIndex = ( rowIndex + j ) % gridDotsPerRow;
            const neighborIndex = neighborRowIndex * gridDotsPerRow + neighborColIndex;

            dotsHolder[ neighborIndex ].inUse = true;
            dotsHolder[ neighborIndex ].cubeIndex = buildingIndex;
            dotsHolder[ neighborIndex ].depth = depth;

            dotsInUse.push( dotsHolder[ neighborIndex ] );

        }

    }

    return dotsInUse;

}

function arrayShuffle( array ) {

    for ( let i = array.length - 1; i > 0; i-- ) {

        const j = Math.floor( Math.random() * ( i + 1 ) );

        [ array[ i ], array[ j ] ] = [ array[ j ], array[ i ] ];

    }

    return array;

}

function addColorVariance( color, variance ) {

    const clamp = ( value, min, max ) => {

        return Math.min( Math.max( value, min ), max );

    }

    return {

        r: clamp( color.r + Math.floor( Math.random() * variance * 2 - variance ), 0, 255 ),
        g: clamp( color.g + Math.floor( Math.random() * variance * 2 - variance ), 0, 255 ),
        b: clamp( color.b + Math.floor( Math.random() * variance * 2 - variance ), 0, 255 ),

    };

}

function calcTileDepth( w, h ) {

    const width = w * gridTileSize;
    const height = h * gridTileSize;

    const areaFactor = w <= 1 && h <= 1 ? 0.15 : 0.05;
    const area = ( width * height ) * areaFactor;
    const depth = Math.random() * area + area;

    return depth;

}

function calcFaceNormalColor( color, faceNormal ) {

    const lightBrightness = 1;

    const dotProductLight = faceNormal.x * lightVector.x + faceNormal.y * lightVector.y + faceNormal.z * lightVector.z;

    const normalMagnitude = Math.sqrt( faceNormal.x * faceNormal.x + faceNormal.y * faceNormal.y + faceNormal.z * faceNormal.z );
    const lightMagnitude = Math.sqrt( lightVector.x * lightVector.x + lightVector.y * lightVector.y + lightVector.z * lightVector.z );

    const lightFactor = ( Math.acos( dotProductLight / ( normalMagnitude * lightMagnitude ) ) / Math.PI ) * lightBrightness;

    const colorValueR = Math.abs( color.r - Math.floor( color.r * lightFactor ) );
    const colorValueG = Math.abs( color.g - Math.floor( color.g * lightFactor ) );
    const colorValueB = Math.abs( color.b - Math.floor( color.b * lightFactor ) );

    return { r: colorValueR, g: colorValueG, b: colorValueB };

}

function addTile( gridTileDots, width, height, type, depth = 0, colorIndex = 0 ) {

    const tile = {};

    tile.dots = gridTileDots;
    tile.w = width;
    tile.h = height;
    tile.type = type;

    //---

    tile.width = width * gridTileSize;
    tile.height = height * gridTileSize;
    tile.depth = 0;

    //---

    if ( tile.type === 'street' ) {

				const dot = tile.dots[ 0 ];

				const dTL = dot;
				const dTR = dot.neighborRight;
				const dBR = dot.neighborRightBottom;
				const dBL = dot.neighborBottom;

				const dT = dot.neighborTop;
				const dB = dot.neighborBottom;
				const dL = dot.neighborLeft;
				const dR = dot.neighborRight;

				let streetTileIndex = 0;

				if ( dT.isStreet === true && dB.isStreet === true && dL.isStreet === false && dR.isStreet === false ) {

						streetTileIndex = 1;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === false && dB.isStreet === false ) {

						streetTileIndex = 2;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true ) {

						streetTileIndex = 3;

				}

				//---

				if ( dT.isStreet === true && dB.isStreet === true && dL.isStreet === false && dR.isStreet === true ) {

						streetTileIndex = 4;

				}

				if ( dT.isStreet === true && dB.isStreet === true && dL.isStreet === true && dR.isStreet === false ) {

						streetTileIndex = 5;

				}

				if ( dT.isStreet === false && dB.isStreet === true && dL.isStreet === true && dR.isStreet === true ) {

						streetTileIndex = 6;

				}

				if ( dT.isStreet === true && dB.isStreet === false && dL.isStreet === true && dR.isStreet === true ) {

						streetTileIndex = 7;

				}

				//---

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dR.neighborTop.isStreet === false && dR.neighborBottom.isStreet === false && dL.neighborTop.isStreet === true && dL.neighborBottom.isStreet === true ) {

						streetTileIndex = 8;


				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dL.neighborTop.isStreet === false && dL.neighborBottom.isStreet === false && dR.neighborTop.isStreet === true && dR.neighborBottom.isStreet === true ) {

						streetTileIndex = 9;

				}

				//---

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === false && dT.neighborRight.isStreet === false && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 10;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === true && dB.neighborLeft.isStreet === false && dB.neighborRight.isStreet === false ) {

						streetTileIndex = 11;

				}

				//---

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === false && dT.neighborRight.isStreet === true && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 12;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === false && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 13;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === true && dB.neighborLeft.isStreet === false && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 14;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === true && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === false ) {

						streetTileIndex = 15;

				}

				//---

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === false && dB.isStreet === false && dR.neighborTop.isStreet === true && dR.neighborBottom.isStreet === true ) {

						streetTileIndex = 16;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === false && dB.isStreet === false && dL.neighborTop.isStreet === true && dL.neighborBottom.isStreet === true ) {

						streetTileIndex = 17;

				}

				if ( dL.isStreet === false && dR.isStreet === false && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === true ) {

						streetTileIndex = 18;

				}

				if ( dL.isStreet === false && dR.isStreet === false && dT.isStreet === true && dB.isStreet === true && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 19;

				}

				//---

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === false && dB.isStreet === true && dR.neighborTop.isStreet === true && dR.neighborBottom.isStreet === true ) {

						streetTileIndex = 20;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === false && dR.neighborTop.isStreet === true && dR.neighborBottom.isStreet === true ) {

						streetTileIndex = 21;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === false && dB.isStreet === true && dL.neighborTop.isStreet === true && dL.neighborBottom.isStreet === true ) {

						streetTileIndex = 22;

				}

				if ( dL.isStreet === true && dR.isStreet === true && dT.isStreet === true && dB.isStreet === false && dL.neighborTop.isStreet === true && dL.neighborBottom.isStreet === true ) {

						streetTileIndex = 23;

				}

				if ( dL.isStreet === false && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 24;

				}

				if ( dL.isStreet === true && dR.isStreet === false && dT.isStreet === true && dB.isStreet === true && dB.neighborLeft.isStreet === true && dB.neighborRight.isStreet === true ) {

						streetTileIndex = 25;

				}

				if ( dL.isStreet === false && dR.isStreet === true && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === true ) {

						streetTileIndex = 26;

				}

				if ( dL.isStreet === true && dR.isStreet === false && dT.isStreet === true && dB.isStreet === true && dT.neighborLeft.isStreet === true && dT.neighborRight.isStreet === true ) {

						streetTileIndex = 27;

				}

				//---

				const uvCoordsIndex = texturesCountBuildingRoofs + texturesCountBuildingWalls + streetTileIndex;

				const street = {

						face: [ dTR, dTL, dBL, dBR ],
						uvCoords: getUvCoordinates( 1, 1 ),
						faceLayer: uvCoordsIndex,

				};

				gridStreetHolder.push( street );

    }

    if ( tile.type === 'building' ) {

        const uvCoordsIndexRoof = Math.floor( Math.random() * texturesCountBuildingRoofs / texturesBuildingRoofsTiles ) * texturesBuildingRoofsTiles;
        const uvCoordsIndexWall = texturesCountBuildingRoofs + Math.floor( Math.random() * texturesCountBuildingWalls / 4 ) * 4;

        //---

        for ( let i = 0, l = tile.dots.length; i < l; i++ ) {

            const dot = tile.dots[ i ];

            const cubeIndex = dot.cubeIndex;
            const depth = dot.depth;

            const cube = {};

            const dTL = dot;
            const dTR = dot.neighborRight;
            const dBR = dot.neighborRightBottom;
            const dBL = dot.neighborBottom;

            cube.distance = Infinity;

            cube.topLeftFront = addVertex( dTL.x, dTL.y, dTL.z - depth );
            cube.topRightFront = addVertex( dTR.x, dTR.y, dTR.z - depth );
            cube.bottomRightFront = addVertex( dBR.x, dBR.y, dBR.z - depth );
            cube.bottomLeftFront = addVertex( dBL.x, dBL.y, dBL.z - depth );

            cube.topLeftBack = dTL;
            cube.topRightBack = dTR;
            cube.bottomRightBack = dBR;
            cube.bottomLeftBack = dBL;

            cube.faces = [ 

                [ cube.topRightFront, cube.topLeftFront, cube.bottomLeftFront, cube.bottomRightFront ], // front
                [ cube.topLeftFront, cube.topLeftBack, cube.bottomLeftBack, cube.bottomLeftFront ], // left
                [ cube.topRightFront, cube.topRightBack, cube.topLeftBack, cube.topLeftFront ], // top
                [ cube.bottomRightFront, cube.bottomRightBack, cube.topRightBack, cube.topRightFront ], //right
                [ cube.bottomLeftFront, cube.bottomLeftBack, cube.bottomRightBack, cube.bottomRightFront ], // bottom

            ];

            //---

            const dT = dot.neighborTop;
            const dB = dot.neighborBottom;
            const dL = dot.neighborLeft;
            const dR = dot.neighborRight;

            //---

            let indexRoof = 0;

            //---

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {
                
                indexRoof = 2;

            }

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                indexRoof = 0;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                indexRoof = 6;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {

                indexRoof = 8;

            }

            //---

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                indexRoof = 1;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                indexRoof = 7;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                indexRoof = 3;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {

                indexRoof = 5;

            }

            //---

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                indexRoof = 4;

            }

            //---

            if ( tile.w === 1 || tile.h === 1 ) {

                indexRoof = 4;

            }

            //---

            const repeatX = Math.round( depth / 3 / 10 );
            const repeatY = 1;

            cube.uvCoords = [
                
                getUvCoordinates( 1, 1 ),
                getUvCoordinates( repeatX, repeatY ),
                getUvCoordinates( repeatX, repeatY ),
                getUvCoordinates( repeatX, repeatY ),
                getUvCoordinates( repeatX, repeatY ),

            ];

            cube.faceLayers = [

                uvCoordsIndexRoof + indexRoof,
                uvCoordsIndexWall + 0,
                uvCoordsIndexWall + 1,
                uvCoordsIndexWall + 2,
                uvCoordsIndexWall + 3,

            ];

            cube.hideFaces = [
                
                true,
                false,
                false,
                false,
                false,

            ];

            cube.drawFaces = [
                
                true,
                true,
                true,
                true,
                true,

            ];

            //---

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = false;

            }

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = false;

            }

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = true;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = false;

            }

            //---

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {
                
                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = true;

            }

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = true;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = false;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = false;

            }

            //---

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = false;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = true;

            }

            //---

            if ( dT.cubeIndex !== cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = false;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = true;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex !== cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = false;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex !== cubeIndex ) {

                cube.hideFaces[ 1 ] = true;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = false;
                cube.hideFaces[ 4 ] = true;

            }

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex !== cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = false;
                cube.hideFaces[ 2 ] = true;
                cube.hideFaces[ 3 ] = true;
                cube.hideFaces[ 4 ] = true;

            }
            
            //---

            if ( dT.cubeIndex === cubeIndex && dB.cubeIndex === cubeIndex && dL.cubeIndex === cubeIndex && dR.cubeIndex === cubeIndex ) {

                cube.hideFaces[ 1 ] = true; //front
                cube.hideFaces[ 2 ] = true; //left
                cube.hideFaces[ 3 ] = true; //top
                cube.hideFaces[ 4 ] = true; //right

            }

            //---

            if ( dot.cubeIndex !== dL.cubeIndex && dot.depth < dL.depth ) {

                cube.hideFaces[ 1 ] = true;

            }

            if ( dot.cubeIndex !== dR.cubeIndex && dot.depth < dR.depth ) {

                cube.hideFaces[ 3 ] = true;

            }

            if ( dot.cubeIndex !== dB.cubeIndex && dot.depth < dB.depth ) {

                cube.hideFaces[ 4 ] = true;

            }

            if ( dot.cubeIndex !== dT.cubeIndex && dot.depth < dT.depth ) {

                cube.hideFaces[ 2 ] = true;

            }

            //---

            gridCubeHolder.push( cube );

        }

        gridTileHolder.push( tile );

    }

}

function addDot( x, y, rowIndex, colIndex ) {

    const dot = addVertex( x, y );

    dot.rowIndex = rowIndex;
    dot.colIndex = colIndex;

    dot.neighborRight = null;
    dot.neighborBottom = null;
    dot.neighborRightBottom = null;
    dot.neighborLeft = null;
    dot.neighborTop = null;

    dot.isStreet = false;
    dot.inUse = false;
    dot.isDebugTile = false;
    dot.cubeIndex = -1;
    dot.depth = 0;

    return dot;

}

function addVertex( x, y, z = 0 ) {

    return {

        x: x,
        y: y,
        z: z,
        x2d: 0,
        y2d: 0,

    };

}

function removeGrid() {

    if ( dotsHolder.length > 0 ) {

        dotsHolder = [];
    
    }

}

//---

function getRandomUniqueIndices( total, count ) {

    const iterator = Math.floor( total / count );
    const start = Math.floor( iterator * 0.5 );

    const indices = [];

    for ( let i = start; i < total; i += iterator ) {

        const index = i + Math.floor( ( Math.random() < 0.5 ? -1 : 1 ) * ( Math.floor( Math.random() * ( start * 0.75 ) ) ) );

        indices.push( index );

        if ( Math.random() >= 0.5 ) {
            
            indices.push( index + 1 );

        }

    }

    return indices;
    
}

//---

function cursorDownHandler( event ) {

    pointerDownButton = event.button;

}

function cursorUpHandler( event ) {

    pointerDownButton = -1;

}

function cursorLeaveHandler( event ) {

    pointerPos = { x: center.x, y: center.y };
    pointerDownButton = -1;
    pointerActive = false;

}

function cursorMoveHandler( event ) {

    pointerActive = true;
    pointerPos = getCursorPosition( canvas, event );

}

function getCursorPosition( element, event ) {

    const rect = element.getBoundingClientRect();
    const position = { x: 0, y: 0 };

    if ( event.type === 'mousemove' || event.type === 'pointermove' ) {

        position.x = event.pageX - rect.left; //event.clientX
        position.y = event.pageY - rect.top; //event.clientY

    } else if ( event.type === 'touchmove' ) {

        position.x = event.touches[ 0 ].pageX - rect.left;
        position.y = event.touches[ 0 ].pageY - rect.top;

    }

    return position;

}

//---

function isTileInsideRectangle( x, y, tileWidth = 0, tileHeight = 0 ) {

    return x > gridStartPositionX + tileWidth * 3 && x < gridEndPositionX - tileWidth * 3 && y > gridStartPositionY + tileHeight * 3 && y < gridEndPositionY - tileHeight * 3;

}

//---

function drawFace( v0, v1, v2, v3, uvCoords, layer ) {
    
    drawTriangle( v0, v1, v2, uvCoords[ 0 ], uvCoords[ 1 ], uvCoords[ 2 ], layer );
    drawTriangle( v2, v3, v0, uvCoords[ 2 ], uvCoords[ 3 ], uvCoords[ 0 ], layer );

}

function drawTriangle( v0, v1, v2, uv0, uv1, uv2, layer ) {

    webgl_vertices.push( v0.x2d, v0.y2d );
    webgl_vertices.push( v1.x2d, v1.y2d );
    webgl_vertices.push( v2.x2d, v2.y2d );

    const index = webgl_faces.length;

    webgl_faces.push( index );
    webgl_faces.push( index + 1 );
    webgl_faces.push( index + 2 );

    webgl_uvs.push( uv0.x, uv0.y );
    webgl_uvs.push( uv1.x, uv1.y );
    webgl_uvs.push( uv2.x, uv2.y );

    webgl_layers.push( layer );
    webgl_layers.push( layer );
    webgl_layers.push( layer );

}

//---

function sortCubes() {

    for ( let i = 0, l = gridCubeHolder.length; i < l; i++ ) {

        const cube = gridCubeHolder[ i ];

        const cubeCenterX = cube.topLeftBack.x + gridTileSizeHalf;
        const cubeCenterY = cube.topLeftBack.y + gridTileSizeHalf;

        cube.distance = calculateDistanceSquared( cubeCenterX, cubeCenterY, 0, 0 );

        //---

        cube.drawFaces[ 1 ] = !cube.hideFaces[ 1 ] && cubeCenterX > 0;
        cube.drawFaces[ 3 ] = !cube.hideFaces[ 3 ] && cubeCenterX <= 0;
        cube.drawFaces[ 2 ] = !cube.hideFaces[ 2 ] && cubeCenterY > 0;
        cube.drawFaces[ 4 ] = !cube.hideFaces[ 4 ] && cubeCenterY <= 0;

    }

    gridCubeHolder = gridCubeHolder.sort( ( a, b ) => {

        return ( b.distance - a.distance );

    } );

}

//---

function render( timestamp ) {

    webgl_vertices = [];
    webgl_faces = [];
    webgl_uvs = [];
    webgl_layers = [];

    //---

    if ( pointerActive === true ) {

        pointer.x += ( pointerPos.x - pointer.x ) / 2;
        pointer.y += ( pointerPos.y - pointer.y ) / 2;

    } else {

        pointer.x += ( pointerInitialPos.x - pointer.x ) / 100;
        pointer.y += ( pointerInitialPos.y - pointer.y ) / 100;

    }

    const dx = ( pointer.x - center.x ) * -0.025;
    const dy = ( pointer.y - center.y ) * -0.025;

    for ( let i = 0, l = dotsHolder.length; i < l; i++ ) {

        const dot = dotsHolder[ i ];

        dot.x += dx;
        dot.y += dy;

        if ( dot.x > gridEndPositionX ) {

            dot.x -= gridWidth;

        }

        if ( dot.x < gridStartPositionX ) {

            dot.x += gridWidth;

        }

        if ( dot.y > gridEndPositionY ) {

            dot.y -= gridHeight;

        }

        if ( dot.y < gridStartPositionY ) {

            dot.y += gridHeight;

        }

    }

    //---

    for ( let i = 0, l = gridStreetHolder.length; i < l; i++ ) {

        const street = gridStreetHolder[ i ];

        const v0 = street.face[ 0 ];
        const v1 = street.face[ 1 ];

        if ( isTileInsideRectangle( v0.x, v1.y, gridTileSize, gridTileSize ) === true ) {

            const v2 = street.face[ 2 ];
            const v3 = street.face[ 3 ];

            projectPoint( v0 );
            projectPoint( v1 );
            projectPoint( v2 );
            projectPoint( v3 );

            drawFace( v0, v1, v2, v3, street.uvCoords, street.faceLayer );

        }

    }

    //---

    const ddx = dx - gridMovementSaveXPos;
    const ddy = dy - gridMovementSaveYPos;

    const gridDistanceMoved = Math.sqrt( ddx * ddx + ddy * ddy );

    if ( gridDistanceMoved >= gridTileSizeHalf ) {

        sortCubes();

        gridMovementSaveXPos = 0;
        gridMovementSaveYPos = 0;
        
    }

    gridMovementSaveXPos += dx;
    gridMovementSaveYPos += dy;

    //---

    for ( let i = 0, l = gridCubeHolder.length; i < l; i++ ) {

        const cube = gridCubeHolder[ i ];

        if ( isTileInsideRectangle( cube.topLeftBack.x, cube.topLeftBack.y, gridTileSize, gridTileSize ) === true ) {

            cube.topLeftFront.x = cube.topLeftBack.x;
            cube.topLeftFront.y = cube.topLeftBack.y;
            cube.topRightFront.x = cube.topRightBack.x;
            cube.topRightFront.y = cube.topRightBack.y;
            cube.bottomRightFront.x = cube.bottomRightBack.x;
            cube.bottomRightFront.y = cube.bottomRightBack.y;
            cube.bottomLeftFront.x = cube.bottomLeftBack.x;
            cube.bottomLeftFront.y = cube.bottomLeftBack.y;

            //---

            for ( let j = cube.faces.length - 1, m = -1; j > m; j-- ) {

                const faceDraw = cube.drawFaces[ j ];

                if ( faceDraw === true ) {

                    const face = cube.faces[ j ];
                    const faceUVCoords = cube.uvCoords[ j ];
                    const faceLayer = cube.faceLayers[ j ];

                    const v0 = face[ 0 ];
                    const v1 = face[ 1 ];
                    const v2 = face[ 2 ];
                    const v3 = face[ 3 ];

                    projectPoint( v0 );
                    projectPoint( v1 );
                    projectPoint( v2 );
                    projectPoint( v3 );

                    drawFace( v0, v1, v2, v3, faceUVCoords, faceLayer );

                }

            }

        }

    }

    //---

    buffers.positionBuffer = createBuffer( gl, gl.ARRAY_BUFFER, new Float32Array( webgl_vertices ), gl.STATIC_DRAW );
    buffers.uvBuffer = createBuffer( gl, gl.ARRAY_BUFFER, new Float32Array( webgl_uvs ), gl.STATIC_DRAW );
    buffers.layerBuffer = createBuffer( gl, gl.ARRAY_BUFFER, new Float32Array( webgl_layers ), gl.STATIC_DRAW );
		buffers.indexBuffer = createBuffer( gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array( webgl_faces ), gl.STATIC_DRAW );

    gl.bindBuffer( gl.ARRAY_BUFFER, buffers.positionBuffer );
    gl.vertexAttribPointer( buffers.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, buffers.uvBuffer );
    gl.vertexAttribPointer( buffers.texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, buffers.layerBuffer );
    gl.vertexAttribPointer( buffers.layerAttributeLocation, 1, gl.FLOAT, false, 0, 0 );
	
		gl.drawElements( gl.TRIANGLES, webgl_faces.length, gl.UNSIGNED_INT, 0 );

    //---

    animationFrame = requestAnimFrame( render );

}

window.requestAnimFrame = ( () => {

    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.msRequestAnimationFrame;

} )();

window.cancelAnimFrame = ( () => {

    return  window.cancelAnimationFrame       ||
            window.mozCancelAnimationFrame;

} )();

//---

function calculateDistanceSquared( x1, y1, x2, y2 ) {

    const dx = x2 - x1;
    const dy = y2 - y1;

    return dx * dx + dy * dy;

}

//---

function projectPoint( v ) {

    const scale = fov / ( fov + v.z );

    v.x2d = v.x * scale + center.x;
    v.y2d = v.y * scale + center.y;

}

//---

function createDebugTexture( color, w = 64, h = 64, padding = 2 ) {

    const canvas = document.createElement( 'canvas' );

    canvas.width = w;
    canvas.height = h;

    const context = canvas.getContext( '2d' );
    const imageData = context.getImageData( 0, 0, w, h );
    const data = imageData.data;

    //---

    context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    context.fillRect( 0, 0, w, h );

    //---

    const image = new Image();

    const promise = new Promise( ( resolve, reject ) => {

        image.addEventListener( 'load', resolve );
        image.addEventListener( 'error', reject );
        image.src = canvas.toDataURL();

    } );

    return {

        image: image,
        promise: promise,

    };
}

function createStreetTexture( textureType, w = 64, h = 64, padding = 2 ) {

    const canvas = document.createElement( 'canvas' );

    canvas.width = w;
    canvas.height = h;

    const context = canvas.getContext( '2d' );
    const imageData = context.getImageData( 0, 0, w, h );
    const data = imageData.data;

    //---

    for ( let i = 0, l = data.length; i < l; i += 4 ) {

        const colorValue = Math.floor( Math.random() * 75 ) + 25;

        data[ i ] = colorValue;
        data[ i + 1 ] = colorValue;
        data[ i + 2 ] = colorValue;
        data[ i + 3 ] = 255;

    }

    context.putImageData( imageData, 0, 0 );

    //---

    if ( textureType === '1x1_vertical' ) {

        const strokeWidthSmall = w / 100 * 2;

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w / 2 - strokeWidthSmall / 2, 0, strokeWidthSmall, h );

    }

    if ( textureType === '1x1_horizontal' ) {

        const strokeWidthSmall = h / 100 * 2;

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( 0, h / 2 - strokeWidthSmall / 2, w, strokeWidthSmall );

    }

    if ( textureType === '1x1_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff, diff, w - diff * 2, h - diff * 2 );

    }

    if ( textureType === '2x1l_vertical' ) {

        const strokeWidthSmall = h / 100 * 1;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2 - strokeWidthSmall / 2, 0 );
        context.lineTo( w / 2 - strokeWidthSmall / 2, h );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( strokeWidthSmall, 0, strokeWidthSmall * 2, h );

    }

    if ( textureType === '2x1r_vertical' ) {

        const strokeWidthSmall = h / 100 * 1;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2 - strokeWidthSmall / 2, 0 );
        context.lineTo( w / 2 - strokeWidthSmall / 2, h );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w - strokeWidthSmall, 0, strokeWidthSmall * 2, h );

    }

    if ( textureType === '1x2t_horizontal' ) {

        const strokeWidthSmall = w / 100 * 1;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( 0, h / 2 - strokeWidthSmall / 2 );
        context.lineTo( w, h / 2 - strokeWidthSmall / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( 0, h - strokeWidthSmall * 2, w, strokeWidthSmall * 2 );

    }

    if ( textureType === '1x2b_horizontal' ) {

        const strokeWidthSmall = w / 100 * 1;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( 0, h / 2 - strokeWidthSmall / 2 );
        context.lineTo( w, h / 2 - strokeWidthSmall / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( 0, 0, w, strokeWidthSmall * 2 );

    }

    if ( textureType === '1x2r_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff, diff, w + diff, h - diff * 2 );

    }

    if ( textureType === '1x2l_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff * -2, diff, w + diff, h - diff * 2 );

    }

    if ( textureType === '2x1t_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff, diff, w - diff * 2, h + diff );

    }

    if ( textureType === '2x1b_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff, diff * -2, w - diff * 2, h + diff );

    }

    if ( textureType === '2x2tl_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff * -2, diff, w + diff, h + diff );

    }

    if ( textureType === '2x2tr_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff, diff, w + diff, h + diff );

    }

    if ( textureType === '2x2bl_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff * -2, diff * -2, w + diff, h + diff );

    }

    if ( textureType === '2x2br_crossing' ) {

        const strokeWidthSmall = h / 100 * 3;
        const diff = w / 100 * 16;

        context.lineWidth = strokeWidthSmall;
        context.setLineDash( [ 10, 10 ] );
        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.strokeRect( diff, diff * -2, w + diff, h + diff );

    }

    if ( textureType === '1x1l_horizontal_crosswalk' ) {

        const strokeWidthSmall = h / 100 * 2;
        const strokeWidthLarge = h / 100 * 15;

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w / 2, h / 2 - strokeWidthSmall / 2, w / 2, strokeWidthSmall );

        context.lineWidth = w / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( strokeWidthLarge, 0 );
        context.lineTo( strokeWidthLarge, h );
        context.stroke();

    }

    if ( textureType === '1x1r_horizontal_crosswalk' ) {

        const strokeWidthSmall = h / 100 * 2;
        const strokeWidthLarge = h / 100 * 15;

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( 0, h / 2 - strokeWidthSmall / 2, w / 2, strokeWidthSmall );

        context.lineWidth = w / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( w - strokeWidthLarge, 0 );
        context.lineTo( w - strokeWidthLarge, h );
        context.stroke();

    }

    if ( textureType === '1x1t_vertical_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 2;
        const strokeWidthLarge = w / 100 * 15;

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w / 2 - strokeWidthSmall / 2, 0, strokeWidthSmall, h / 2 );

        context.lineWidth = h / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( 0, h - strokeWidthLarge );
        context.lineTo( w, h - strokeWidthLarge );
        context.stroke();

    }

    if ( textureType === '1x1b_vertical_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 2;
        const strokeWidthLarge = w / 100 * 15;

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w / 2 - strokeWidthSmall / 2, h / 2, strokeWidthSmall, h );

        context.lineWidth = h / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( 0, strokeWidthLarge );
        context.lineTo( w, strokeWidthLarge );
        context.stroke();

    }

    if ( textureType === '1x2lt_horizontal_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2, h / 2 - strokeWidthSmall / 2 );
        context.lineTo( w, h / 2 - strokeWidthSmall / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w / 2, h - strokeWidthSmall * 2, w, strokeWidthSmall * 2 );

        context.lineWidth = w / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( strokeWidthLarge, 0 );
        context.lineTo( strokeWidthLarge, h );
        context.stroke();

    }

    if ( textureType === '1x2lb_horizontal_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2, h / 2 - strokeWidthSmall / 2 );
        context.lineTo( w, h / 2 - strokeWidthSmall / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w / 2, 0, w, strokeWidthSmall * 2 );

        context.lineWidth = w / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( strokeWidthLarge, 0 );
        context.lineTo( strokeWidthLarge, h );
        context.stroke();

    }

    if ( textureType === '1x2rt_horizontal_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( 0, h / 2 - strokeWidthSmall / 2 );
        context.lineTo( w / 2, h / 2 - strokeWidthSmall / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( 0, h - strokeWidthSmall * 2, w / 2, strokeWidthSmall * 2 );

        context.lineWidth = w / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( w - strokeWidthLarge, 0 );
        context.lineTo( w - strokeWidthLarge, h );
        context.stroke();

    }

    if ( textureType === '1x2rb_horizontal_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( 0, h / 2 - strokeWidthSmall / 2 );
        context.lineTo( w / 2, h / 2 - strokeWidthSmall / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( 0, 0, w / 2, strokeWidthSmall * 2 );

        context.lineWidth = w / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( w - strokeWidthLarge, 0 );
        context.lineTo( w - strokeWidthLarge, h );
        context.stroke();

    }

    if ( textureType === '2x1tl_vertical_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2 - strokeWidthSmall / 2, 0 );
        context.lineTo( w / 2 - strokeWidthSmall / 2, h / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( strokeWidthSmall, 0, strokeWidthSmall * 2, h / 2 );

        context.lineWidth = h / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( 0, h - strokeWidthLarge );
        context.lineTo( w, h - strokeWidthLarge );
        context.stroke();

    }

    if ( textureType === '2x1tr_vertical_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2 - strokeWidthSmall / 2, 0 );
        context.lineTo( w / 2 - strokeWidthSmall / 2, h / 2 );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w - strokeWidthSmall, 0, strokeWidthSmall * 2, h / 2 );

        context.lineWidth = h / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( 0, h - strokeWidthLarge );
        context.lineTo( w, h - strokeWidthLarge );
        context.stroke();

    }

    if ( textureType === '2x1bl_vertical_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2 - strokeWidthSmall / 2, h / 2 );
        context.lineTo( w / 2 - strokeWidthSmall / 2, h );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( strokeWidthSmall, h / 2, strokeWidthSmall * 2, h );

        context.lineWidth = h / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( 0, strokeWidthLarge );
        context.lineTo( w, strokeWidthLarge );
        context.stroke();

    }

    if ( textureType === '2x1br_vertical_crosswalk' ) {

        const strokeWidthSmall = w / 100 * 1;
        const strokeWidthLarge = w / 100 * 15;

        context.strokeStyle = `rgb(${255}, ${255}, ${255})`;
        context.setLineDash( [ 20, 20 ] );
        context.beginPath();
        context.moveTo( w / 2 - strokeWidthSmall / 2, h / 2 );
        context.lineTo( w / 2 - strokeWidthSmall / 2, h );
        context.stroke();

        context.fillStyle = `rgb(${255}, ${255}, ${255})`;
        context.fillRect( w - strokeWidthSmall, h / 2, strokeWidthSmall * 2, h );

        context.lineWidth = h / 2.5;
        context.setLineDash( [ 5, 10 ] );
        context.strokeStyle = `rgb(${125}, ${125}, ${125})`;
        context.beginPath();
        context.moveTo( 0, strokeWidthLarge );
        context.lineTo( w, strokeWidthLarge );
        context.stroke();

    }

    //---

    const image = new Image();

    const promise = new Promise( ( resolve, reject ) => {

        image.addEventListener( 'load', resolve );
        image.addEventListener( 'error', reject );
        image.src = canvas.toDataURL();

    } );

    return {

        image: image,
        promise: promise,

    };

}

function createRoofTexture( textureType, colorRoof, w = 64, h = 64, numRows = 3, numCols = 3 ) {

    const addLargeDetails = ( context ) => {

        const maxInnerWidth = width * 0.75 - roofBorderWidth * 2;
        const maxInnerHeight = height * 0.75 - roofBorderWidth * 2;

        const rectWidth = Math.random() * ( maxInnerWidth - w ) + w;
        const rectHeight = Math.random() * ( maxInnerHeight - h ) + h;

        const x = roofBorderWidth + Math.random() * ( maxInnerWidth - rectWidth );
        const y = roofBorderWidth + Math.random() * ( maxInnerHeight - rectHeight );

        context.fillStyle = `rgba(${colorRoof.r}, ${colorRoof.g}, ${colorRoof.b}, ${Math.random() * 0.5 + 0.25})`;
        context.fillRect( x, y, rectWidth, rectHeight );

        context.strokeStyle = `rgba(0, 0, 0, 0.5)`;
        context.strokeRect( x, y, rectWidth, rectHeight );


    };

    const addSmallDetails = ( context ) => {

        const radius = w * ( Math.random() * 0.15 + 0.15 );
        const diameter = radius * 2;

        if ( Math.random() > 0.75 ) {

            context.fillStyle = `rgba(${colorRoof.r * 0.15}, ${colorRoof.g * 0.15}, ${colorRoof.b * 0.15}, ${Math.random() * 0.5 + 0.25})`;
            context.beginPath();
            context.arc( w * 0.5, h * 0.5, radius, 0, 2 * Math.PI);
            context.fill();

            context.fillStyle = `rgba(${colorRoof.r * 0.88}, ${colorRoof.g * 0.88}, ${colorRoof.b * 0.88}, ${Math.random() * 0.5 + 0.25})`;
            context.beginPath();
            context.arc( w * 0.5 + 3, h * 0.5 + 3, Math.abs( radius - 6 ), 0, 2 * Math.PI);
            context.fill();

        } else {

            context.fillStyle = `rgba(${colorRoof.r * 0.15}, ${colorRoof.g * 0.15}, ${colorRoof.b * 0.15}, ${Math.random() * 0.5 + 0.25})`;
            context.fillRect( roofBorderWidth, roofBorderWidth, diameter, diameter );

            context.fillStyle = `rgba(${colorRoof.r * 0.88}, ${colorRoof.g * 0.88}, ${colorRoof.b * 0.88}, ${Math.random() * 0.5 + 0.25})`;
            context.fillRect( roofBorderWidth + 3, roofBorderWidth + 3, diameter - 6, diameter - 6 );

        }

    };

    //---

    const width = w * numRows;
    const height = h * numCols;

    const canvas = document.createElement( 'canvas' );

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext( '2d' );
    const imageData = context.getImageData( 0, 0, width, height );
    const data = imageData.data;

    //---

    for ( let i = 0, l = data.length; i < l; i += 4 ) {

        const colorValue = Math.floor( Math.random() * 125 );
        const colorDarkRandom = Math.random() * 0.15 + 0.4;

        data[ i ] = Math.floor( colorRoof.r * colorDarkRandom ) + colorValue;
        data[ i + 1 ] = Math.floor( colorRoof.g * colorDarkRandom ) + colorValue;
        data[ i + 2 ] = Math.floor( colorRoof.b * colorDarkRandom ) + colorValue;
        data[ i + 3 ] = 255;

    }

    context.putImageData( imageData, 0, 0 );

    //---

    const roofBorderWidth = Math.random() * ( w * 0.15 ) + ( w * 0.15 );
    const roofRandomColorDiff = 1 - ( Math.random() * 0.6 + 0.2 );

    context.fillStyle = `rgba(${colorRoof.r * roofRandomColorDiff}, ${colorRoof.g * roofRandomColorDiff}, ${colorRoof.b * roofRandomColorDiff}, ${Math.random() * 0.25 + 0.25})`;
    context.fillRect( roofBorderWidth, roofBorderWidth, width - roofBorderWidth * 2, height - roofBorderWidth * 2 );

    context.lineWidth = Math.min( roofBorderWidth * 0.25, 4 );
    context.strokeStyle = `rgba(${colorRoof.r * 0.15}, ${colorRoof.g * 0.15}, ${colorRoof.b * 0.15}, ${Math.random() * 0.5 + 0.5})`;
    context.strokeRect( roofBorderWidth, roofBorderWidth, width - roofBorderWidth * 2, height - roofBorderWidth * 2 );

    if ( Math.random() > 0.25 ) {

        addLargeDetails( context );

    }

    //---

    const imagesAndPromises = [];

    for ( let row = 0; row < numRows; row++ ) {

        for ( let col = 0; col < numCols; col++ ) {

            const smallCanvas = document.createElement( 'canvas' );

            smallCanvas.width = w;
            smallCanvas.height = h;

            const smallContext = smallCanvas.getContext( '2d' );

            smallContext.drawImage( canvas, col * w, row * h, w, h, 0, 0, w, h );

            //---

            if ( Math.random() > 0.65 ) {

                addSmallDetails( smallContext );

            }

            //---

            const image = new Image();

            const promise = new Promise( ( resolve, reject ) => {

                image.addEventListener( 'load', resolve );
                image.addEventListener( 'error', reject );
                image.src = smallCanvas.toDataURL();

            } );

            imagesAndPromises.push( {

                image: image,
                promise: promise

            } );

        }

    }

    return imagesAndPromises;

}

function createWallTexture( textureType, colorWall, colorWindows, windowRatio, repeatX, repeatY, p, w = 64, h = 64 ) {

    const canvas = document.createElement('canvas');

    canvas.width = w;
    canvas.height = h;

    const context = canvas.getContext('2d');

    //---

    const rgbWindows = `rgb(${colorWindows.r}, ${colorWindows.g}, ${colorWindows.b})`;
    const rgbWall = `rgb(${colorWall.r}, ${colorWall.g}, ${colorWall.b})`;

    context.fillStyle = rgbWall;
    context.fillRect( 0, 0, w, h );

    if ( textureType === 0 ) {

        const wallRatio = 1 - windowRatio;

        const totalHeight = h / repeatY;
        const windowHeight = totalHeight * windowRatio;
        const wallHeight = totalHeight * wallRatio;
        const border = wallHeight * 0.5;

        for ( let i = 0; i < repeatY; i++ ) {

            const y = i * totalHeight + border;

            context.fillStyle = rgbWindows;
            context.fillRect( 0, y, w, windowHeight );

        }

    } else if ( textureType === 1 ) {

        const wallRatio = 1 - windowRatio;

        const totalWidth = w / repeatX;
        const windowWidth = totalWidth * windowRatio;
        const wallWidth = totalWidth * wallRatio;
        const border = wallWidth * 0.5;

        for ( let i = 0; i < repeatX; i++ ) {

            const x = i * totalWidth + border;

            context.fillStyle = rgbWindows;
            context.fillRect( x, 0, windowWidth, h );

        }

    } else if ( textureType === 2 ) {

        const border = p;
        const windowWidth = ( w - border - ( repeatX - 1 ) * border ) / repeatX;
        const windowHeight = ( h - border - ( repeatY - 1 ) * border)  / repeatY;

        for ( let row = 0; row < repeatY; row++ ) {

            for ( let col = 0; col < repeatX; col++ ) {

                const x = col * ( windowWidth + border ) + border * 0.5;
                const y = row * ( windowHeight + border ) + border * 0.5;

                context.fillStyle = rgbWindows;
                context.fillRect( x, y, windowWidth, windowHeight );

            }

        }

    } else if ( textureType === 3 ) {

        const border = p;

        const windowWidth = w / repeatX;
        const windowHeight = h / repeatY;

        for ( let row = 0; row < repeatY; row++ ) {

            for ( let col = 0; col < repeatX; col++ ) {

                const x = col * windowWidth;
                const y = row * windowHeight;

                context.fillStyle = rgbWindows;
                context.fillRect( x, y, windowWidth, windowHeight );

                context.lineWidth = border * 5;
                context.strokeStyle = rgbWall;
                context.beginPath();
                context.moveTo( x, y );
                context.lineTo( x + windowWidth, y + windowHeight );
                context.stroke();
                context.beginPath();
                context.moveTo( x + windowWidth, y );
                context.lineTo( x , y + windowHeight );
                context.stroke();

            }

        }

    } else if ( textureType === 4 ) {

        const border = p;

        const windowWidth = w / repeatX;
        const windowHeight = h / repeatY;

        for ( let row = 0; row < repeatY; row++ ) {

            for ( let col = 0; col < repeatX; col++ ) {

                const x = col * windowWidth;
                const y = row * windowHeight;

                context.fillStyle = rgbWindows;
                context.fillRect( x, y, windowWidth, windowHeight );

                if ( p > 0.5 ) {

                    context.setLineDash( [ 2, 4 ] );
                    context.lineWidth = windowWidth * 0.25;

                } else {

                    context.lineWidth = windowWidth * 0.10;

                }

                context.strokeStyle = rgbWall;
                context.beginPath();
                context.moveTo( x, y );
                context.lineTo( x + windowWidth, y + windowHeight );
                context.stroke();
                context.beginPath();
                context.moveTo( x + windowWidth, y );
                context.lineTo( x , y + windowHeight );
                context.stroke();

                if ( p > 0.5 ) {

                    context.lineWidth = windowWidth * 0.5;

                } else {

                    context.lineWidth = windowWidth * 0.2;

                }

                context.beginPath();
                context.moveTo( x + windowWidth * 0.5, y );
                context.lineTo( x + windowWidth * 0.5, y + windowHeight );
                context.stroke();
                context.beginPath();
                context.moveTo( x + windowWidth * 1, y );
                context.lineTo( x + windowWidth * 1, y + windowHeight );
                context.stroke();
                context.beginPath();
                context.moveTo( x, y );
                context.lineTo( x, y + h );
                context.stroke();

            }

        }

    } else if ( textureType === 5 ) {

        const border = p;

        const windowWidth = w / repeatX;
        const windowHeight = h / repeatY;

        for ( let row = 0; row < repeatY; row++ ) {

            for ( let col = 0; col < repeatX; col++ ) {

                const x = col * windowWidth;
                const y = row * windowHeight;

                context.fillStyle = rgbWindows;
                context.beginPath();
                context.arc( x + windowWidth * 0.5, y + windowHeight * 0.5, windowWidth * 0.25, 0, 2 * Math.PI);
                context.fill();

            }

        }

    } else if ( textureType === 6 ) {

        const border = p;

        const windowWidth = w / repeatX;
        const windowHeight = h / repeatY;

        for ( let row = 0; row < repeatY; row++ ) {

            for ( let col = 0; col < repeatX; col++ ) {

                const x = col * windowWidth;
                const y = row * windowHeight;

                context.lineWidth = windowWidth * 0.25;
                context.setLineDash( [ p, p ] );
                context.strokeStyle = rgbWindows;
                context.beginPath();
                context.moveTo( x + windowWidth * 0.25, y );
                context.lineTo( x + windowWidth * 0.25, y + windowHeight );
                context.stroke();
                context.beginPath();
                context.moveTo( x + windowWidth * 0.75, y );
                context.lineTo( x + windowWidth * 0.75, y + windowHeight );
                context.stroke();

            }

        }

    } else if ( textureType === 7 ) {

        const border = p;

        const windowWidth = w / repeatX;
        const windowHeight = h / repeatY;

        for ( let row = 0; row < repeatY; row++ ) {

            for ( let col = 0; col < repeatX; col++ ) {

                const x = col * windowWidth;
                const y = row * windowHeight;

                context.fillStyle = rgbWindows;
                context.fillRect( x, y, windowWidth, windowHeight );

                const lineWidth = windowWidth * p;
                context.fillStyle = rgbWall;
                context.fillRect( x, y - lineWidth * 0.5, windowWidth, lineWidth );
                context.fillRect( x, y + windowWidth - lineWidth * 0.5, windowWidth, lineWidth );

                context.lineWidth = windowHeight;
                context.setLineDash( [ 6, 6 ] );
                context.strokeStyle = rgbWall;
                context.beginPath();
                context.moveTo( x, y + windowHeight * 0.5 );
                context.lineTo( x + windowWidth, y + windowHeight * 0.5 );
                context.stroke();

            }

        }

    }

    //---

    const image = new Image();

    const promise = new Promise( ( resolve, reject ) => {

        image.addEventListener( 'load', resolve );
        image.addEventListener( 'error', reject );
        image.src = canvas.toDataURL();

    } );

    return {

        image: image,
        promise: promise,

    };

}

//---

function createShaderProgram( gl, vsSource, fsSource ) {

    const vertexShader = createShader( gl, vsSource, gl.VERTEX_SHADER );
    const fragmentShader = createShader( gl, fsSource, gl.FRAGMENT_SHADER );

    const shaderProgram = gl.createProgram();

    gl.attachShader( shaderProgram, vertexShader );
    gl.attachShader( shaderProgram, fragmentShader );
    gl.linkProgram( shaderProgram );
    gl.useProgram( shaderProgram );

    if ( !gl.getProgramParameter( shaderProgram, gl.LINK_STATUS ) ) {

        console.log( 'Could not compile WebGL program. \n\n' + gl.getProgramInfoLog( shaderProgram ) );

    }

    return shaderProgram;

}

function createBuffer( gl, target, bufferArray, usage ) {

    const buffer = gl.createBuffer();

    gl.bindBuffer( target, buffer );
    gl.bufferData( target, bufferArray, usage );

    return buffer;

}

function createShader( gl, shaderCode, type ) {

    const shader = gl.createShader( type );

    gl.shaderSource( shader, shaderCode );
    gl.compileShader( shader );

    if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {

        console.log( 'Could not compile WebGL program. \n\n' + gl.getShaderInfoLog( shader ) );

    }

    return shader;

}

function createTextureArray( gl, width, height, numTextures ) {

    const texture = gl.createTexture();

    gl.bindTexture( gl.TEXTURE_2D_ARRAY, texture );

    gl.texParameteri( gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR );
    gl.texParameteri( gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
    gl.texParameteri( gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT );
    gl.texParameteri( gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT );
    gl.texParameteri( gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_R, gl.REPEAT );

    gl.texImage3D( gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, width, height, numTextures, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );

    return texture;

}

function loadTextureIntoArray( gl, textureArray, layer, image, width, height ) {

    gl.bindTexture( gl.TEXTURE_2D_ARRAY, textureArray );

    gl.texSubImage3D( gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, width, height, 1, gl.RGBA, gl.UNSIGNED_BYTE, image );

}

//---

function getUvCoordinates( repeatX = 1, repeatY = 1 ) {

    return [

        { x: 0, y: 0 },
        { x: repeatX, y: 0 },
        { x: repeatX, y: repeatY },
        { x: 0, y: repeatY },

    ];

}

//---

document.addEventListener( 'DOMContentLoaded', () => {

    init();

} );