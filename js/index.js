console.log('coucou');

let renderer, scene, raycaster, mouse, clickSelectedObjects;

const container = document.getElementById('scene-container');
// Helper const wich we will use as a additional correction coefficient for objects and camera
let mouseIsDown = false;
let fpds = 0; // frame per sec/10
let frames = 0; // current frame

const keysPressed = {};

let rotWorldMatrix;
// Rotate an object around an arbitrary axis in world space
function rotateAroundWorldAxis(object, axis, radians) {
  rotWorldMatrix = new THREE.Matrix4();
  rotWorldMatrix.makeRotationAxis(axis.normalize(), radians);
  // old code for Three.JS pre r54:
  //  rotWorldMatrix.multiply(object.matrix);
  // new code for Three.JS r55+:
  rotWorldMatrix.multiply(object.matrix); // pre-multiply

  object.matrix = rotWorldMatrix;

  // old code for Three.js pre r49:
  // object.rotation.getRotationFromMatrix(object.matrix, object.scale);
  // old code for Three.js pre r59:
  // object.rotation.setEulerFromRotationMatrix(object.matrix);
  // code for r59+:
  object.rotation.setFromRotationMatrix(object.matrix);
}


const cube = ({ size, color, position }) => {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshBasicMaterial({ color });
  const c = new THREE.Mesh(geometry, material);
  c.position.x = position.x;
  c.position.y = position.y;
  c.position.z = position.z;

  return c;
};

class MainCharacter {
  constructor({ name, threeObj, camera }) {
    this.name = name;
    this.camera = camera;
    this.threeObj = threeObj;
    this.groups = [];
    this.isAlive = true;
    this.init();
  }

  init() {
    this.behavior = {
      logMySelf: () => {
        console.log('this', this);
      },
      m: {
        mouve: (x, y) => {
          const { threeObj, camera: { position: cp }, behavior: { m: { currentSpeed } } } = this;
          const { position: p } = threeObj;
          let { lastLookToDirection: lastL } = this.behavior.m;

          const mouvementDirectionVector = new THREE.Vector3(p.x + x, p.y + y, p.z);
          const pos = new THREE.Vector3(p.x, p.y, p.z);
          // pos.addVectors(mouvementDirectionVector, threeObj.position);

          if (pos.distanceTo(mouvementDirectionVector) > .02) {
            lastL = mouvementDirectionVector;
            threeObj.lookAt(new THREE.Vector3(lastL.x, lastL.y, lastL.z));
          }
          currentSpeed.total = pos.distanceTo(mouvementDirectionVector);

          p.set(p.x + x, p.y + y, p.z);
          cp.set(cp.x + x, cp.y + y, cp.z);

          const vector = mouvementDirectionVector.multiplyScalar(.2, .2, .2);

          // p.set(p.x + vector.x, p.y + vector.y, p.z + vector.z);
          // cp.set(cp.x + vector.x, cp.y + vector.y, cp.z + vector.z);
          console.log(p.x + vector.x, p.y + vector.y, p.z + vector.z);
        },
        // lookAt: () => {
        //   const p = threeObj.position;

        //   const lookDirectionVector = new THREE.Vector3(p.x + x, p.y + y, p.z);
        //   const pos = new THREE.Vector3();
        //   pos.addVectors(lookDirectionVector, threeObj.position);

        //   threeObj.lookAt(pos);
        // },
        speeds: {
          nominal: 0.1,
          sprint: 0.2,
        },
        accelerations: {
          nominal: 0.2,
          sprint: 0.3,
        },
        lastLookToDirection: { x: 0, y: 0, z: 0 },
        speed: 0.1,
        acceleration: 0.2,
        // look: {
        //   x: 0
        //   y: 0
        //   x: 0
        // },
        currentSpeed: { x: 0, y: 0, total: 0 },
        accelerate: (axis) => {
          const { currentSpeed, speed, accelerationPerFps } = this.behavior.m;
          currentSpeed[axis] -= accelerationPerFps();
          // console.log(this.behavior.m.currentSpeed);
          return speed;
        },
        // decelerate: (axis) => {
        //   const { currentSpeed, maxSpeed, deceleration } = this.behavior.m;
        //   currentSpeed[axis] -= deceleration / (fpds * 10);
        //   console.log(this.behavior.m.currentSpeed);
        //   return maxSpeed;
        // },
        accelerationPerFps: () => {
          const { acceleration } = this.behavior.m;
          return acceleration / fpds;
        },
        action: () => {
          const { currentSpeed, mouve, accelerationPerFps } = this.behavior.m;
          const speedX = currentSpeed.x;
          const speedY = currentSpeed.y;
          if (speedX >= accelerationPerFps() || speedX <= -accelerationPerFps()
            || speedY >= accelerationPerFps() || speedY <= -accelerationPerFps()) {
            // console.log(speedX, speedY);
            mouve(speedX, speedY);
            if (currentSpeed.x !== 0) currentSpeed.x += (currentSpeed.x > 0 ? -accelerationPerFps() : accelerationPerFps());
            if (currentSpeed.y !== 0) currentSpeed.y += (currentSpeed.y > 0 ? -accelerationPerFps() : accelerationPerFps());
          }


          // this.behavior.m.mouve(this.behavior.m.currentSpeed);
          // this.behavior.m.decelerate('x');
          // this.behavior.m.decelerate('y');
        }
      },
      mouveUp: () => {
        const { currentSpeed, accelerationPerFps, speed } = this.behavior.m;
        if (currentSpeed.y < speed && currentSpeed.y > -speed) {
          currentSpeed.y += accelerationPerFps() * 2;
        }
      },
      mouveDown: () => {
        const { currentSpeed, accelerationPerFps, speed } = this.behavior.m;
        if (currentSpeed.y < speed && currentSpeed.y > -speed) {
          currentSpeed.y += -accelerationPerFps() * 2;
        }
      },
      mouveLeft: () => {
        const { currentSpeed, accelerationPerFps, speed } = this.behavior.m;
        if (currentSpeed.x < speed && currentSpeed.x > -speed) {
          currentSpeed.x += -accelerationPerFps() * 2;
        }
      },
      mouveRight: () => {
        const { currentSpeed, accelerationPerFps, speed } = this.behavior.m;
        if (currentSpeed.x < speed && currentSpeed.x > -speed) {
          currentSpeed.x += accelerationPerFps() * 2;
        }
      },
      sprint: () => {
        const { m } = this.behavior;
        m.speed = m.speeds.sprint;
        m.acceleration = m.accelerations.sprint;
      },
      unsprint: () => {
        const { m } = this.behavior;
        m.speed = m.speeds.nominal;
        m.acceleration = m.accelerations.nominal;
      }
    };

  }
}

const perso = new MainCharacter({ name: 'bily', threeObj: cube({ size: { x: 2, y: 1, z: 1, }, position: { x: 0, y: 0, z: 0 }, color: 0xfff000 }) });

const keysControls = {
  KeyW: [{ f: perso.behavior.mouveUp, triggering: ['holddown'] }], // Z
  KeyA: [{ f: perso.behavior.mouveLeft, triggering: ['holddown'] }], // Q
  KeyS: [{ f: perso.behavior.mouveDown, triggering: ['holddown'] }],
  KeyD: [{ f: perso.behavior.mouveRight, triggering: ['holddown'] }],
  KeyQ: [{ f: perso.behavior.logMySelf, triggering: ['onkeydown'] }], // A
  ShiftLeft: [{ f: perso.behavior.sprint, triggering: ['onkeydown'] }, { f: perso.behavior.unsprint, triggering: ['onkeyup'] }],
};

function init() {
  // init renderer
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0f0f33, 1);
  container.appendChild(renderer.domElement);

  // init scene and camera
  scene = new THREE.Scene();
  perso.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.2, 10000);
  perso.camera.position.set(0, -10, 15);
  perso.camera.rotation.set(Math.PI / 6, 0, 0);
  scene.add(perso.camera);

  // init lightning
  const light = new THREE.PointLight(0xffffbb, 0x080820, 0);
  light.position.set(20, 50, 20);

  // light_two = new THREE.PointLight(0xffff00, 20, 4000);
  // light_two.position.set(-100, 800, 800);

  scene.add(
    light,
    // light_two
  );


  scene.add(perso.threeObj);

  const mouseSen = 4;
  // window.addEventListener('mousewheel', (e) => {
  //   // const p = camera.position;
  //   // camera.position.set(p.x, p.y, p.z += e.deltaY / (200 / mouseSen));
  // });

  onmousedown = () => {
    clickSelectedObjects = raycaster.intersectObjects(scene.children);
    mouseIsDown = true;
  };
  onmouseup = () => {
    clickSelectedObjects = [];
    mouseIsDown = false;
  };
  let lastPos;
  onmousemove = (e) => {
    // let lastPos = lastPos ? lastPos : { x: e.clientX, y: e.clientY };
    if (mouseIsDown) {
      const newPos = { x: e.clientX, y: e.clientY };
      for (let i = 0; i < clickSelectedObjects.length; i += 1) {
        const o = clickSelectedObjects[i].object;
        // const r = o.rotation;
        // r.set(r.x -= (lastPos.y - newPos.y) / (200 / mouseSen), r.y -= (lastPos.x - newPos.x) / (200 / mouseSen), r.z);
        const xAxis = new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3(0, 1, 0);

        rotateAroundWorldAxis(o, xAxis, -(lastPos.y - newPos.y) / (200 / mouseSen));
        rotateAroundWorldAxis(o, yAxis, -(lastPos.x - newPos.x) / (200 / mouseSen));
      }

      if (clickSelectedObjects.length <= 0) {
        const p = perso.camera.position;
        perso.camera.position.set(
          p.x += (lastPos.x - newPos.x) / (100 / mouseSen),
          p.y -= (lastPos.y - newPos.y) / (100 / mouseSen),
          p.z
        );
        // console.log(p);
      }
      // rotateAroundWorldAxis(test, axis, radians);
    }
    lastPos = { x: e.clientX, y: e.clientY };
    // Raycaster
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  onkeydown = (e) => {
    // console.log(e.code);

    keysPressed[e.code] = true;

    Object.keys(keysPressed)
      .forEach((k) => {
        if (keysPressed[k] && keysControls[k]) {
          keysControls[k].forEach((funcObj) => {
            if (
              funcObj
              && typeof funcObj === 'object'
              && funcObj.triggering && funcObj.triggering.includes('onkeydown')
              && typeof funcObj.f === 'function'
            ) {
              funcObj.f();
            }

          });
        }
      });
  };
  onkeyup = (e) => {


    Object.keys(keysPressed)
      .forEach((k) => {
        if (keysPressed[k] && keysControls[k]) {
          keysControls[k].forEach((funcObj) => {
            if (
              funcObj
              && typeof funcObj === 'object'
              && funcObj.triggering && funcObj.triggering.includes('onkeyup')
              && typeof funcObj.f === 'function'
            ) {
              funcObj.f();
            }

          });
        }
      });
    keysPressed[e.code] = false;
  };

  const sizeOne = { x: .5, y: .5, z: .5 };
  const cubex = cube({ size: sizeOne, color: 0xff0000, position: { x: 3, y: 0, z: 0 } });
  const cubey = cube({ size: sizeOne, color: 0x00ff00, position: { x: 0, y: 3, z: 0 } });
  const cubez = cube({ size: sizeOne, color: 0x0000ff, position: { x: 0, y: 0, z: 3 } });

  scene.add(cubex, cubey, cubez);
}

setInterval(() => {
  fpds = frames;
  frames = 0;
}, 1000);

const render = () => {

  window.scroll(0, 0);
  requestAnimationFrame(render);

  Object.keys(keysPressed)
    .forEach((k) => {
      if (keysPressed[k] && keysControls[k]) {
        keysControls[k].forEach((funcObj) => {
          if (
            funcObj
            && typeof funcObj === 'object'
            && funcObj.triggering && funcObj.triggering.includes('holddown')
            && typeof funcObj.f === 'function'
          ) {
            funcObj.f();
          }

        });
      }
    });

  frames += 1;

  perso.behavior.m.action();
  raycaster.setFromCamera(mouse, perso.camera);
  renderer.render(scene, perso.camera);
};

init();
render();
