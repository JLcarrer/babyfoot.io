import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import io from 'socket.io-client';
const socket = io('http://141.145.210.192:3001/');

const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const roomNameInput = document.getElementById('roomNameInput');

var scene;
var camera;
var renderer;
let team;
let current = null;
let babyfoot = null;
let ballMesh;

const url = 'http://141.145.210.192:80/'

function initialiseThree(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  scene.background = new THREE.Color(0x9ab586);

  camera.position.z = 40;
  camera.position.y = 15;
  camera.lookAt(0, 0, 0);

  addBabyFoot();
  addBall();
  addLight();
}

function createRoom(name){
  camera.position.z = -40;
  team = [5, 4, 2, 6];
  socket.emit('create', name);
}

function joinRoom(name){
  team = [8, 7, 1, 3];
  socket.emit('join', name);
}

socket.on('updateBall', (data) => {
  ballMesh.position.x = data.x;
  ballMesh.position.y = data.y;
  ballMesh.position.z = data.z;
});

socket.on('updatePlayer', (data) => {
  babyfoot.children[data.player].position.z = data.position;
  babyfoot.children[data.player].rotation.z = data.rotation;
  console.log(data);
});

socket.on('start', () => {
  window.requestAnimationFrame(loop);
});

initialiseThree();
render();

function addBabyFoot(){
  const loader = new GLTFLoader();
  loader.load(url + 'babyfoot', function (gltf) {
    babyfoot = gltf.scene;
    babyfoot.scale.set(1, 1, 1);
    scene.add(babyfoot);
  });
}

function addBall(){
  const geometry = new THREE.SphereGeometry(0.25, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  ballMesh = new THREE.Mesh(geometry, material);
  ballMesh.position.y = 2;
  scene.add(ballMesh);
}
            
function addLight(){
  const light = new THREE.PointLight(0xffffff, 1, 1000);
  light.position.set(0, 10, 0);
  scene.add(light);
  
  const ambientLight = new THREE.AmbientLight(0xf0f0f0);
  scene.add(ambientLight);
}

function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

let lastRender = 0;

function loop(timestamp) {
  var ms = timestamp - lastRender;
  var delta = ms / 1000;
  update(delta);
  lastRender = timestamp;
  window.requestAnimationFrame(loop)
}

function update(delta) {
  if(Math.abs(camera.position.z) > 7.5){
    camera.position.z = lerp(camera.position.z, 0, 0.01) * (1 - delta);
    camera.lookAt(0, 0, 0);
  }
  if(babyfoot != null){
    gravityRotation();
  }
}

function gravityRotation(){
  for(let i = 0; i < 4; i++){
    if(team[i] != current){
      babyfoot.children[team[i]].rotation.z = lerp(babyfoot.children[team[i]].rotation.z, 0, 0.05);
    }
  }
}

function reset(){
  for(let i = 0; i < 4; i++){
    babyfoot.children[team[i]].rotation.z = 0;
    babyfoot.children[team[i]].position.z = 0;
  }
}

function lerp(start, end, amt){
  return (1-amt)*start+amt*end
}

function clamp(value, min, max){
  return Math.min(Math.max(value, min), max);
}

document.addEventListener('mousemove', (e) => {
  if(babyfoot != null && current != null){
    let x = e.clientX;
    let y = e.clientY;
    babyfoot.children[current].rotation.z = (x * 0.01 - 9.6) * (team[0] === 5 ? 0.2 : -0.2);
    babyfoot.children[current].position.z = clamp(y * 0.01 - 2, -3.5, 3.5) * (team[0] === 5 ? 0.5 : -0.5);
    socket.emit('updatePlayer', {
      player: current, 
      position: babyfoot.children[current].position.z, 
      rotation: babyfoot.children[current].rotation.z
    });
  }
});

document.addEventListener('keydown', (event) => {
  switch(event.key){
    case 'a':
      current = team[0];
      break;
    case 'z':
      current = team[1];
      break;
    case 'e':
      current = team[2];
      break;
    case 'r':
      current = team[3];
      break;
    case 't':
      reset();
      break;
  }
});

createRoomButton.addEventListener('click', () => {
  createRoom(roomNameInput.value);
});

joinRoomButton.addEventListener('click', () => {
  joinRoom(roomNameInput.value);
});