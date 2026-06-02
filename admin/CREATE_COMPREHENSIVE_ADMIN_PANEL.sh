#!/bin/bash

# ======================================
# پنل ادمین جامع با 10 ماژول کامل
# ======================================

cd /home/claude/admin-panel

# ساختار پوشه‌ها
mkdir -p src/{components/{layout,widgets,products,categories,orders,customers,coupons,reports,tickets,settings},pages,stores,utils,data}
mkdir -p public

# ===========================================
# فایل‌های اصلی
# ===========================================

# vite.config.js
cat > vite.config.js << 'VITE'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
})
VITE

# index.html
cat > index.html << 'HTML'
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>پنل مدیریت ای‌کا‌جی کالا</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
HTML

# src/main.jsx
cat > src/main.jsx << 'MAIN'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import faIR from 'antd/locale/fa_IR'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={faIR} direction="rtl" theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
)
MAIN

# src/index.css
cat > src/index.css << 'CSS'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  direction: rtl;
  text-align: right;
}

.ant-layout {
  min-height: 100vh;
}

/* Fix RTL for Ant Design */
.ant-menu {
  border-inline-start: none !important;
}

.dashboard-widgets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.widget-card {
  cursor: move;
}

.widget-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* React Quill RTL */
.quill {
  direction: rtl;
}

.ql-editor {
  min-height: 200px;
  direction: rtl;
  text-align: right;
}

/* Tree draggable */
.draggable-tree .ant-tree-node-content-wrapper {
  cursor: move;
}

.variant-table .ant-table-cell {
  padding: 8px !important;
}
CSS

echo "✅ فایل‌های اصلی ایجاد شد"
