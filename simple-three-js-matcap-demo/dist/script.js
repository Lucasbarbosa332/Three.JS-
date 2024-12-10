import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {ImprovedNoise} from "three/addons/math/ImprovedNoise.js";
import {GUI} from "three/addons/libs/lil-gui.module.min.js";

const containerEl = document.querySelector(".container");
const canvasEl = document.querySelector("#canvas-3d");
const previewsContainer = document.querySelector(".matcap-previews");

let renderer, scene, camera, orbit, material, geometry;

// no need to use a 3d noise here, 
// keeping ImprovedNoise() just for code simplicity
const perlin = new ImprovedNoise();

const params = {
    resolution: 12,
    previewPadding: 3,
    amplitude: 1
}
const texturesURL = [
    "https://ksenia-k.com/img/threejs/matcaps/1.png",
    "https://ksenia-k.com/img/threejs/matcaps/2.png",
    "https://ksenia-k.com/img/threejs/matcaps/3.png",
    "https://ksenia-k.com/img/threejs/matcaps/4.png",
    "https://ksenia-k.com/img/threejs/matcaps/5.png",
    "https://ksenia-k.com/img/threejs/matcaps/6.png",
    "https://ksenia-k.com/img/threejs/matcaps/7.png",
]
const textureLoader = new THREE.TextureLoader();
const textures = [];

initScene();
createControls();
window.addEventListener("resize", updateSceneSize);


texturesURL.forEach(((url, idx) => {
    const canvasContainer = document.createElement("div");
    const canvas = document.createElement("canvas");
    previewsContainer.appendChild(canvasContainer);
    canvasContainer.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    textures.push(textureLoader.load(
        url,
        (t) => {
            canvas.width = t.image.width;
            canvas.height = t.image.height;
            ctx.drawImage(t.image, 0, 0);
            canvasContainer.style.margin = params.previewPadding + "px";
            canvasContainer.style.padding = params.previewPadding + "px";
            canvasContainer.onclick = function () {
                const prevSelection = previewsContainer.querySelector(".active");
                if (prevSelection) {
                    prevSelection.classList.remove("active");
                }
                canvasContainer.classList.add("active");
                material.matcap = t;
            }

            if (idx === 5) {
                canvasContainer.classList.add("active");
                material.matcap = t;
            }

            if (textures.length === texturesURL.length) {
                updateSceneSize();
            }
        })
    );
}))


function initScene() {
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvasEl
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, containerEl.clientWidth / containerEl.clientHeight, 1, 50);
    camera.position.set(0, 1, 10);

    material = new THREE.MeshMatcapMaterial({
        side: THREE.DoubleSide
    });

    orbit = new OrbitControls(camera, canvasEl);
    orbit.enableZoom = false;
    orbit.enablePan = false;
    orbit.enableDamping = true;
    orbit.minPolarAngle = .4 * Math.PI;
    orbit.maxPolarAngle = .6 * Math.PI;

    geometry = new THREE.PlaneGeometry(5, 4, 5 * params.resolution, 4 * params.resolution);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    mesh.rotation.set(-.5 * Math.PI, 0, .15 * Math.PI);

    updateSceneSize();
    render();
}

function render(time) {
    orbit.update();
    renderer.render(scene, camera);

    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] = perlin.noise(.5 * positions[i] + .0005 * time, .5 * positions[i + 1] + .0005 * time, 0);
        positions[i + 2] -= 1.5 * perlin.noise(.2 * positions[i] - .0002 * time, .2 * positions[i + 1] + .0002 * time, 0);
        positions[i + 2] *= params.amplitude;
    }
    geometry.attributes.position.copyArray(positions);
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    material.needsUpdate = true;

    requestAnimationFrame(render);
}

function updateSceneSize() {
    camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    if (textures) {
        const w = .8 * Math.min(window.innerWidth, window.innerHeight);
        Array.from(previewsContainer.children).forEach(canvas => {
            canvas.style.width = (w - 4 * params.previewPadding) + "px";
        })
    }
}

function createControls() {
    const gui = new GUI();
    gui
        .add(params, "amplitude", 0, 1.5)
        .name("noise amplitude")
}