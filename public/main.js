// Import App and router (which are now simple objects or functions)
import App from './App.js';
import router from './router/index.js';
import { createApp } from 'vue';

console.log(Vue.version);

document.body.classList.add('bg-gray-800', 'text-white', 'm-0', 'font-sans');


// // Create the Vue app and use the router
const app = Vue.createApp(App);
app.use(router); 
app.mount('#app');
