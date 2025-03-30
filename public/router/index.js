import Landing from "../components/Landing.js";
import Binder from "../components/Binder.js";
import Library from "../components/Library.js";

const routes = [
  {
    path: "/",
    component: Landing,
    name: "landing",
  },
  {
    path: "/binder",
    component: Binder,
    name: "binder",
  },
  {
    path: "/library",
    component: Library,
    name: "library",
  },
  {
    path: "/binder/:channelName",
    component: Binder,
    name: "binderWithChannel",
    props: true,
  },
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const loggedIn = true;
  if (to.meta.requiresAuth && !loggedIn) {
    next({ name: "landing" });
  } else {
    next();
  }
});

export default router;