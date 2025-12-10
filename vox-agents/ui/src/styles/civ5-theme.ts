// Civ5-inspired theme preset for PrimeVue
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const Civ5Theme = definePreset(Aura, {
  semantic: {
    // Primary color - Civ5 gold/bronze
    primary: {
      50: '{amber.50}',
      100: '{amber.100}',
      200: '{amber.200}',
      300: '{amber.300}',
      400: '{amber.400}',
      500: '{amber.500}',
      600: '{amber.600}',
      700: '{amber.700}',
      800: '{amber.800}',
      900: '{amber.900}',
      950: '{amber.950}'
    }
  }
})

export default {
  preset: Civ5Theme,
  options: {
    prefix: 'p',
    darkModeSelector: '.dark-mode',
    cssLayer: false
  }
}