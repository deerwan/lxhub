import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setupStore } from './store'
import { getPlatformConfig } from './config'
import { useElementPlus } from './plugins/elementPlus'
import { initStorage } from './utils/storage'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/index.scss'

const app = createApp(App)

/**
 * 与 `vue-pure-admin` 保持一致的启动顺序：
 * 先拉取 `public/platform-config.json`，再依次挂载 pinia、router、element-plus。
 */
getPlatformConfig(app).then(async () => {
  initStorage()
  setupStore(app)
  app.use(router)
  await router.isReady()
  useElementPlus(app)
  app.mount('#app')
})
