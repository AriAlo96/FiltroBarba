import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: "/",
    name: "camara",
    component: () => import("../views/Camara.vue"),    
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
