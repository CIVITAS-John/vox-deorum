import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import Civ5Theme from './styles/civ5-theme'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './styles/global.css'

const app = createApp(App)

// Configure PrimeVue with Civ5-inspired theme
app.use(PrimeVue, {
  theme: Civ5Theme
})

// Add confirmation service for dialogs
app.use(ConfirmationService)

// Add toast service for notifications
app.use(ToastService)

// Add tooltip directive
app.directive('tooltip', Tooltip)

app.use(router)

app.mount('#app')
