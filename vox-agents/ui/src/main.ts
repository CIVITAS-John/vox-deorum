import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import Civ5Theme from './styles/civ5-theme'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './styles/global.css'

const app = createApp(App)

// Configure PrimeVue with Civ5-inspired theme
app.use(PrimeVue, {
  theme: Civ5Theme
})

app.use(router)

app.mount('#app')
