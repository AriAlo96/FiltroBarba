<template>
  <div id="app" style="margin: 0; padding: 0; overflow: hidden">
    <div ref="threeContainer" style="position: absolute; top: 0; left: 0; width: 100vw; height: 100vh"></div>
    <div style="position: absolute; bottom: -42%; width: 2px; height: 100vw; background: rgba(255, 255, 255, 0.3); z-index: 2; transform: rotate(-90deg); right: 50%;"></div>
    <video ref="video" autoplay playsinline muted style="display: none"></video>
    <transition name="fade">
      <div v-if="!faceDetected" class="overlay-full-image">
        <div class="contenedorTextos">
          <h2 class="titulo">
            <span class="bold">ACERCATE</span> AL ESPEJO Y<br />
            VIVÍ LA <span class="bold">EXPERIENCIA</span>
          </h2>
          <img class="logoGillete" src="@/assets/logoGilletteBlanco.png" alt="Gillette Logo" />
        </div>
        <img class="almoby" src="@/assets/Developed by.png" alt="Almoby Logo" />
      </div>
    </transition>
  </div>
</template>

<script>
import * as THREE from "three";
import { markRaw } from "vue";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera as MP_Camera } from "@mediapipe/camera_utils";

export default {
  name: "FullScreenAR",
  data() {
    return {
      scene: null,
      camera: null,
      renderer: null,
      backgroundMesh: null,
      faceMesh: null,
      mpCamera: null,
      containerWidth: 0,
      containerHeight: 0,
      videoAspect: 9 / 16,
      faceDetected: false,
    };
  },
  mounted() {
    this.containerWidth = this.$refs.threeContainer.clientWidth;
    this.containerHeight = this.$refs.threeContainer.clientHeight;
    this.initThree();
    this.initFaceMesh();
  },
  methods: {
    initThree() {
      this.scene = markRaw(new THREE.Scene());
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

      const geoWidth = this.containerWidth;
      const geoHeight = this.containerHeight;

      const bgGeometry = new THREE.PlaneGeometry(geoWidth, geoHeight);
      const bgMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
      this.backgroundMesh = markRaw(new THREE.Mesh(bgGeometry, bgMaterial));
      this.backgroundMesh.position.set(0, 0, -1);
      this.scene.add(this.backgroundMesh);

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
        refineLandmarks: false,
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

.overlay-full-image {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10;
  background-color: #1b244e;
}

.contenedorTextos {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5vw;
  transform: rotate(-90deg);
  width: 80vw;
}

.titulo {
  color: white;
  font-weight: 400;
  font-size: 4vw;
  margin-bottom: 1.5rem;
  line-height: 100%;
}

.bold {
  font-weight: 900;
}

.logoGillete {
  width: 40vw;
}

.almoby {
  object-fit: contain;
  transform: rotate(-90deg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
