// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme'
import Changelog from './Changelog.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Changelog', Changelog)
  }
}
