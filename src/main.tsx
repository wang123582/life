import React from 'react'
import ReactDOM from 'react-dom/client'
// 手写体只需要拉丁子集：中文落到系统楷体，两边合起来就是一只手写的字。
// 数字和时间交给等宽体——那是机器写的，本来就该跟人写的字分开。
import '@fontsource-variable/caveat/wght.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import App from './App'
import './index.css'
import { registerServiceWorker } from './lib/pwa'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
