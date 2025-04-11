<template>
  <div id="app" style="margin: 0; padding: 0; overflow: hidden">
    <div
      ref="threeContainer"
      style="position: absolute; top: 0; left: 0; width: 100vw; height: 100vh"
    ></div>
    <div
      style="
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px;
        background: rgba(255, 255, 255, 0.3);
        z-index: 2;
      "
    ></div>
    <video ref="video" autoplay playsinline muted style="display: none"></video>
    <transition name="fade">
  <div v-if="!faceDetected" class="overlay-message">
    <img src="@/assets/Gillette-Logo.png" alt="Gillette Logo" class="logo" />
    <p class="instruction">Sentate frente al espejo para probar el filtro</p>
  </div>
</transition>
  </div>
</template>

<script>
import * as THREE from "three";
import { markRaw } from "vue";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera as MP_Camera } from "@mediapipe/camera_utils";
import barba3 from "@/assets/barba.png";

export default {
  name: "FullScreenAR",
  data() {
    return {
      lastBeardPosition: null,
      lastBeardRotation: undefined,
      lastBeardScale: 1,
      containerWidth: 0,
      containerHeight: 0,
      videoAspect: 4 / 3,
      faceDetected: false,
    };
  },
  mounted() {
    this.scene = markRaw(new THREE.Scene());
    this.camera = null;
    this.renderer = null;
    this.backgroundMesh = null;
    this.beardMesh = null;
    this.faceMesh = null;
    this.mpCamera = null;

    this.containerWidth = this.$refs.threeContainer.clientWidth;
    this.containerHeight = this.$refs.threeContainer.clientHeight;
    this.initThree();
    this.initFaceMesh();
  },
  methods: {
    initThree() {
      const left = -this.containerWidth / 2;
      const right = this.containerWidth / 2;
      const top = this.containerHeight / 2;
      const bottom = -this.containerHeight / 2;
      this.camera = markRaw(
        new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000)
      );
      this.camera.position.z = 10;

      this.renderer = markRaw(new THREE.WebGLRenderer({ alpha: true }));
      this.renderer.setSize(this.containerWidth, this.containerHeight);
      this.$refs.threeContainer.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.transform = "scaleX(-1)";

      const videoEl = this.$refs.video;
      const videoTexture = new THREE.VideoTexture(videoEl);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBFormat;

      const containerAspect = this.containerWidth / this.containerHeight;
      let geoWidth, geoHeight;
      if (containerAspect > this.videoAspect) {
        geoHeight = this.containerHeight;
        geoWidth = geoHeight * this.videoAspect;
      } else {
        geoWidth = this.containerWidth;
        geoHeight = geoWidth / this.videoAspect;
      }

      const scaleFactor = Math.max(
        this.containerWidth / geoWidth,
        this.containerHeight / geoHeight
      );
      const bgGeometry = new THREE.PlaneGeometry(geoWidth, geoHeight);
      const bgMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
      this.backgroundMesh = markRaw(new THREE.Mesh(bgGeometry, bgMaterial));
      this.backgroundMesh.scale.set(scaleFactor, scaleFactor, 1);
      this.backgroundMesh.position.set(0, 0, -1);
      this.scene.add(this.backgroundMesh);

      const loader = new THREE.TextureLoader();
      loader.load(barba3, (texture) => {
        const geometry = new THREE.PlaneGeometry(130, 100);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        this.beardMesh = markRaw(new THREE.Mesh(geometry, material));
        this.beardMesh.position.set(0, 0, 1);
        this.scene.add(this.beardMesh);
      });

      this.animate();
    },
    animate() {
      requestAnimationFrame(this.animate);
      this.renderer.render(this.scene, this.camera);
    },
    initFaceMesh() {
      this.faceMesh = markRaw(
        new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        })
      );
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.faceMesh.onResults(this.onResults);

      const videoEl = this.$refs.video;
      this.mpCamera = markRaw(
        new MP_Camera(videoEl, {
          onFrame: async () => {
            await this.faceMesh.send({ image: videoEl });
          },
          width: 640,
          height: 480,
        })
      );
      this.mpCamera.start();
    },
    onResults(results) {
      this.faceDetected = !!(
        results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0
      );
      if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0 ||
        !this.beardMesh
      ) {
  this.faceDetected = false;
  if (this.beardMesh) this.beardMesh.visible = false; // 👈 oculta la barba
  return;
}

      const landmarks = results.multiFaceLandmarks[0];
      const chin = landmarks[152];
      const bottomLip = landmarks[17];
      const forehead = landmarks[10];
      const leftJaw = landmarks[127];
      const rightJaw = landmarks[356];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];

      const anchorNormX = chin.x;
      const anchorNormY = chin.y * 0.65 + bottomLip.y * 0.3;
      const faceHeight = Math.abs((chin.y - forehead.y) * this.containerHeight);
      const baseYOffset = -0.15 * faceHeight;
      const verticalTilt = chin.y - forehead.y;
      const tiltOffset = THREE.MathUtils.clamp(
        verticalTilt * this.containerHeight * 0.2,
        -20,
        20
      );
      const offsetX = -5;
      const cheekDeltaYForPosition = leftCheek.y - rightCheek.y;
      const tiltSideFactor = THREE.MathUtils.clamp(
        cheekDeltaYForPosition,
        -0.03,
        0.03
      );
      const tiltCorrection = tiltSideFactor * this.containerWidth * 0.1;
      const targetX =
        (anchorNormX - 0.5) * this.containerWidth + offsetX + tiltCorrection;
      const targetY =
        (0.5 - anchorNormY) * this.containerHeight + baseYOffset + tiltOffset;

      const newPos = new THREE.Vector3(targetX, targetY, 1);
      if (!this.lastBeardPosition) {
        this.lastBeardPosition = newPos.clone();
      } else {
        this.lastBeardPosition.lerp(newPos, 0.3);
      }
      this.beardMesh.position.copy(this.lastBeardPosition);

      const jawWidth = Math.abs((rightJaw.x - leftJaw.x) * this.containerWidth);
      const desiredBeardWidth = jawWidth * 1; // más adaptable
      const originalBeardWidth = 130;
      const targetScaleX = desiredBeardWidth / originalBeardWidth;
      const finalScaleX = THREE.MathUtils.lerp(
        this.lastBeardScale || targetScaleX,
        targetScaleX,
        0.5
      );
      this.lastBeardScale = finalScaleX;
      const factorY = 1.15;
      this.beardMesh.scale.set(finalScaleX, finalScaleX * factorY, 1);

      const dx = (rightEye.x - leftEye.x) * this.containerWidth;
      const dy = (0.5 - rightEye.y - (0.5 - leftEye.y)) * this.containerHeight;
      const angle = Math.atan2(dy, dx);
      const cheekDeltaY = leftCheek.y - rightCheek.y;
      const tiltSideAngle = THREE.MathUtils.clamp(cheekDeltaY * 2, -0.5, 0.5);

      if (this.lastBeardRotation === undefined) {
        this.lastBeardRotation = angle;
      } else {
        this.lastBeardRotation = THREE.MathUtils.lerp(
          this.lastBeardRotation,
          angle,
          0.3
        );
      }
      this.beardMesh.rotation.z = this.lastBeardRotation + tiltSideAngle;

      this.beardMesh.visible = this.lastBeardPosition.x > 0;
    },
  },
};
</script>

<style scoped>
html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.overlay-message {
  position: absolute;
  z-index: 10;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background: rgba(0, 0, 0, 0.4);
  padding: 30px;
  border-radius: 12px;
  color: white;
  font-family: 'Segoe UI', sans-serif;
  animation: fadeIn 0.5s ease-in-out;
}

.overlay-message .logo {
  max-width: 200px;
  margin-bottom: 20px;
}

.overlay-message .instruction {
  font-size: 1.5rem;
  font-weight: bold;
}

@keyframes fadeIn {
  from { opacity: 0 }
  to { opacity: 1 }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.instruction {
  text-shadow: 0 2px 4px rgba(0,0,0,0.6);
}
</style>
