import express from 'express';
const app = express();
import http from 'http';
const server = http.createServer(app);
import * as SocketIO from 'socket.io';
const io = new SocketIO.Server(server, {cors: {origin: '*'}});
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'node-three-gltf';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
let rooms = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static('build'));

app.get('/babyfoot', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.sendFile(__dirname + '/models/babyfoot.gltf');
    console.log("Sending babyfoot model");
});

app.listen(80, () => {
    console.log('Express listening on port 80');
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('create', (name) => {
        console.log("Creating room : " + name);
        rooms.push(new Room(name, socket));
    });

    socket.on('join', (name) => {
        console.log("Joining room : " + name);
        rooms.forEach((room) => {
            if(room.name == name){
                room.blue = socket;
                room.blue.emit('start');
                room.red.emit('start');
                room.start();
            }
        });
    });

    socket.on('updatePlayer', (data) => {
        rooms.forEach((room) => {
            if(room.red == socket){
                room.blue.emit('updatePlayer', data);
            }
            if(room.blue == socket){
                room.red.emit('updatePlayer', data);
            }
            room.updatePlayer(data);
        });
    });

    socket.on('runBall', () => {
        rooms.forEach((room) => {
            room.runBall();
        });
    });

    socket.on('ping', (ms) => {
        socket.emit('pong', ms);
    });

    socket.on('setPing', (ping) => {
        rooms.forEach((room) => {
            if(room.red == socket){
                room.redPing = ping;
            }
            if(room.blue == socket){
                room.bluePing = ping;
            }
        });
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(3001, () => {
    console.log('SocketIO listening on port 3001');
});

class Room{
    constructor(name, player){
        this.name = name;
        this.red = player;
        this.redPing = 0;
        this.bluePing = 0;
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.playerStartPos = [];
        this.playerBodies = [];
        this.addTerrain();
        this.addPlayers();
    }

    addTerrain(){
        const loader = new GLTFLoader();
        loader.load('models/collider.gltf', (gltf) => {
            const collider = gltf.scene;
            const vertices = collider.children[0].geometry.attributes.position.array;
            const indices = collider.children[0].geometry.index.array;
            const colliderShape = new CANNON.Trimesh(vertices, indices);
            this.groundMaterial = new CANNON.Material("groundMaterial");
            const colliderBody = new CANNON.Body({mass: 0, material: this.groundMaterial});
            colliderShape.setScale(new CANNON.Vec3(11, 2, 6));
            colliderBody.addShape(colliderShape);
            colliderBody.position.x = 0;
            colliderBody.position.y = 1.25;
            colliderBody.position.z = 0;
            this.world.addBody(colliderBody);
            this.addBall();
        });
    }

    addBall(){
        const sphereShape = new CANNON.Sphere(0.25);
        this.ballMaterial = new CANNON.Material("ballMaterial");
        this.ballBody = new CANNON.Body({ mass: 1, material: this.ballMaterial });
        this.ballBody.addShape(sphereShape);
        this.ballBody.position.x = 0;
        this.ballBody.position.y = 2;
        this.ballBody.position.z = 0;
        this.ballBody.velocity.set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
        this.ballBody.linearDamping = 0.1;
        const mat = new CANNON.ContactMaterial(this.groundMaterial, this.ballMaterial, {friction: 0.1, restitution: 0.8});
        this.world.addContactMaterial(mat);
        this.world.addBody(this.ballBody)
    }

    addPlayers(){
        this.addPlayer(-10.5, 0, 5);
        this.addPlayer(-7.5, -2, 4);
        this.addPlayer(-7.5, 2, 4);
        this.addPlayer(-4.5, -3, 3);
        this.addPlayer(-4.5, 0, 3);
        this.addPlayer(-4.5, 3, 3);
        this.addPlayer(-1.5, -4, 2);
        this.addPlayer(-1.5, -2, 2);
        this.addPlayer(-1.5, 0, 2);
        this.addPlayer(-1.5, 2, 2);
        this.addPlayer(-1.5, 4, 2);
        this.addPlayer(1.5, -4, 1);
        this.addPlayer(1.5, -2, 1);
        this.addPlayer(1.5, 0, 1);
        this.addPlayer(1.5, 2, 1);
        this.addPlayer(1.5, 4, 1);
        this.addPlayer(4.5, -3, 6);
        this.addPlayer(4.5, 0, 6);
        this.addPlayer(4.5, 3, 6);
        this.addPlayer(7.5, -2, 7);
        this.addPlayer(7.5, 2, 7);
        this.addPlayer(10.5, 0, 8);
    }

    addPlayer(x, z, player){
        const collider = new CANNON.Box(new CANNON.Vec3(0.125, 1.25, 0.25));
        let playerMaterial = new CANNON.Material('playerMaterial');
        const colliderBody = new CANNON.Body({ mass: 0, material: playerMaterial });
        colliderBody.addShape(collider);
        colliderBody.position.x = x;
        colliderBody.position.y = 2.5;
        colliderBody.position.z = z;
        this.world.addBody(colliderBody);
        this.playerStartPos.push({z: z, player: player});
        this.playerBodies.push(colliderBody);
    }

    runBall(){
        this.ballBody.velocity.set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
    }

    start(){
        console.log(this.name);
        this.update();
    }

    updateBall(){
        let redPosition = this.ballBody.position + (this.redPing / 1000) * this.ballBody.velocity;
        let bluePosition = this.ballBody.position + (this.bluePing / 1000) * this.ballBody.velocity;
        this.red.emit('updateBall', redPosition);
        this.blue.emit('updateBall', bluePosition);
        console.log(this.ballBody.position);
    }

    updatePlayer(data){
        for(let i = 0; i < this.playerStartPos.length; i++){
            if(this.playerStartPos[i].player == data.player){
                this.playerBodies[i].position.z = this.playerStartPos[i].z + data.position;
                this.playerBodies[i].quaternion.setFromEuler(0, 0, data.rotation);
            }
        }
    }

    update(){
        this.world.step(1/60);
        this.updateBall();
        setTimeout(() => this.update(), 1000/60);
    }
}