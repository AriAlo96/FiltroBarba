<template>
  <div id="app" style="margin: 0; padding: 0; overflow: hidden">
    <!-- Contenedor Three.js a pantalla completa -->
    <div
      ref="threeContainer"
      style="position: absolute; top: 0; left: 0; width: 100vw; height: 100vh"
    ></div>
    <!-- Video oculto para alimentar FaceMesh y servir de fuente para la textura -->
    <video ref="video" autoplay playsinline muted style="display: none"></video>
  </div>
</template>

<script>
import * as THREE from "three";
import { markRaw } from "vue";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera as MP_Camera } from "@mediapipe/camera_utils";
import beardTextureImg from "@/assets/barba.png";

export default {
  name: "FullScreenAR",
  data() {
    return {
      containerWidth: 0,
      containerHeight: 0,
      // Objetos Three.js sin reactividad:
      scene: null,
      camera: null,
      renderer: null,
      backgroundMesh: null,
      beardMesh: null,
      // MediaPipe
      faceMesh: null,
      mpCamera: null,
      // Aspecto del video esperado (por ejemplo, 4:3 para 640x480)
      videoAspect: 4 / 3,
      // Variables para suavizar la posición y rotación
      lastBeardPosition: null,
      lastBeardRotation: undefined,
    };
  },
  mounted() {
    // Medir el contenedor completo
    this.containerWidth = this.$refs.threeContainer.clientWidth;
    this.containerHeight = this.$refs.threeContainer.clientHeight;
    this.initThree();
    this.initFaceMesh();
  },
  methods: {
    initThree() {
      // Crear la escena
      this.scene = markRaw(new THREE.Scene());

      // Configurar la cámara ortográfica:
      // Queremos un sistema de coordenadas en pixeles: X en [-W/2, W/2] y Y en [-H/2, H/2]
      const left = -this.containerWidth / 2;
      const right = this.containerWidth / 2;
      const top = this.containerHeight / 2;
      const bottom = -this.containerHeight / 2;
      this.camera = markRaw(
        new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000)
      );
      this.camera.position.z = 10; // La cámara se coloca en z=10

      // Crear el renderer y asignarlo al contenedor
      this.renderer = markRaw(new THREE.WebGLRenderer({ alpha: true }));
      this.renderer.setSize(this.containerWidth, this.containerHeight);
      this.$refs.threeContainer.appendChild(this.renderer.domElement);

      // Aplicar el efecto espejo al canvas
      this.renderer.domElement.style.transform = "scaleX(-1)";

      // Crear la textura de video
      const videoEl = this.$refs.video;
      const videoTexture = new THREE.VideoTexture(videoEl);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBFormat;

      // Crear un plano de fondo que preserve el aspecto del video
      // Calculamos dimensiones de un plano que tenga el mismo aspecto que el video (4:3) y que se escale para cubrir el contenedor.
      const containerAspect = this.containerWidth / this.containerHeight;
      let geoWidth, geoHeight;
      if (containerAspect > this.videoAspect) {
        // Contenedor más ancho: usa la altura del contenedor y ajusta el ancho
        geoHeight = this.containerHeight;
        geoWidth = geoHeight * this.videoAspect;
      } else {
        // Contenedor más alto: usa el ancho del contenedor y ajusta la altura
        geoWidth = this.containerWidth;
        geoHeight = geoWidth / this.videoAspect;
      }
      // Para asegurarnos de que el plano cubra el contenedor, escalamos uniformemente:
      const scaleFactor = Math.max(
        this.containerWidth / geoWidth,
        this.containerHeight / geoHeight
      );

      const bgGeometry = new THREE.PlaneGeometry(geoWidth, geoHeight);
      const bgMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
      this.backgroundMesh = markRaw(new THREE.Mesh(bgGeometry, bgMaterial));
      this.backgroundMesh.scale.set(scaleFactor, scaleFactor, 1);
      this.backgroundMesh.position.set(0, 0, 0);
      this.scene.add(this.backgroundMesh);

      // Cargar la textura de la barba y crear su plano
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(beardTextureImg, (texture) => {
        // Define dimensiones del plano de la barba (en pixeles)
        // Ajusta estos valores hasta que se vea bien sobre el rostro
        const beardWidth = 130;
        const beardHeight = 100;
        const geometry = new THREE.PlaneGeometry(beardWidth, beardHeight);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        this.beardMesh = markRaw(new THREE.Mesh(geometry, material));
        // Colocar la barba inicialmente en z=1 (delante del fondo)
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
      // Inicializar FaceMesh de MediaPipe usando markRaw
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

      // Configurar MP_Camera para alimentar FaceMesh con el video
      const videoEl = this.$refs.video;
      this.mpCamera = markRaw(
        new MP_Camera(videoEl, {
          onFrame: async () => {
            await this.faceMesh.send({ image: videoEl });
          },
          width: 640, // Resolución deseada para la cámara (ej. 640x480)
          height: 480,
        })
      );
      this.mpCamera.start();
      // Para depuración, podrías quitar el display: none al video
      // videoEl.style.display = 'block';
    },
    onResults(results) {
      if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0 ||
        !this.beardMesh
      ) {
        return;
      }
      const landmarks = results.multiFaceLandmarks[0];

      // --- Cálculo del punto de anclaje ---
      // Utilizamos el landmark del mentón y el punto medio entre las mejillas para obtener un ancla más estable
      const chin = landmarks[152];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      const midCheek = {
        x: (leftCheek.x + rightCheek.x) / 2,
        y: (leftCheek.y + rightCheek.y) / 2,
      };
      // Ponderamos mayormente el mentón
      const weightChin = 0.7,
        weightCheek = 0.3;
      const anchorNormX = weightChin * chin.x + weightCheek * midCheek.x;
      const anchorNormY = weightChin * chin.y + weightCheek * midCheek.y;

      // --- Offset dinámico basado en la altura del rostro ---
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const midEye = {
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2,
      };
      const faceHeight = Math.abs((chin.y - midEye.y) * this.containerHeight);
      const dynamicOffset = -0.2 * faceHeight; // Factor ajustable según necesites

      // Convertir las coordenadas normalizadas a pixeles
      const targetX = (anchorNormX - 0.5) * this.containerWidth;
      const targetY =
        (0.5 - anchorNormY) * this.containerHeight + dynamicOffset;

      // --- Suavizado de la posición usando lerp ---
      const newPos = new THREE.Vector3(targetX, targetY, 1);
      if (!this.lastBeardPosition) {
        this.lastBeardPosition = newPos.clone();
      } else {
        // Ajusta el factor (0.3 en este ejemplo) para controlar la suavidad
        this.lastBeardPosition.lerp(newPos, 0.3);
      }
      this.beardMesh.position.copy(this.lastBeardPosition);

      // --- Ajuste de la escala de la barba en función del ancho de la cara ---
      const faceWidth = Math.abs(
        (rightCheek.x - leftCheek.x) * this.containerWidth
      );
      const desiredBeardWidth = faceWidth * 1.1; // Por ejemplo, 120% del ancho de la cara
      const originalBeardWidth = 150; // Valor base de tu geometría
      const scaleX = desiredBeardWidth / originalBeardWidth;
      const factorAdicionalY = 1.3; // Para que la barba sea un poco más alta
      this.beardMesh.scale.set(scaleX, scaleX * factorAdicionalY, 1);

      // --- Suavizado de la rotación basado en la línea de los ojos ---
      const dx = (rightEye.x - leftEye.x) * this.containerWidth;
      const dy =
        (0.5 - rightEye.y - (0.5 - leftEye.y)) * this.containerHeight;
      const angle = Math.atan2(dy, dx);
      if (this.lastBeardRotation === undefined) {
        this.lastBeardRotation = angle;
      } else {
        // Suavizamos la rotación (ajusta el factor 0.3 según necesites)
        this.lastBeardRotation = THREE.MathUtils.lerp(
          this.lastBeardRotation,
          angle,
          0.3
        );
      }
      this.beardMesh.rotation.z = this.lastBeardRotation;
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
</style>
