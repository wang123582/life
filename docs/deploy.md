# HTTPS / 部署说明

当前项目是一个 **Vite + React + TypeScript + PWA** 的纯静态站点，最适合部署到支持自动 HTTPS 的静态托管平台。

## 首选方案

### 推荐平台：Cloudflare Pages

原因：

- 纯静态站点部署简单
- 自动 HTTPS
- 免费档足够
- 对 PWA 很友好
- 后续手机安装体验更稳

## 部署前提

在部署前，本项目已经具备这些基础：

- `manifest.webmanifest`
- `service worker`
- PWA 图标
- `npm run build` 可正常产出 `dist/`

## 最简单的部署步骤（Cloudflare Pages）

### 方式 1：连接 Git 仓库自动部署

1. 把 `life/` 项目推到 GitHub 仓库
2. 打开 Cloudflare Pages
3. 选择 `Create a project`
4. 连接 GitHub 仓库
5. 构建设置填写：
   - Build command：`npm run build`
   - Build output directory：`dist`
6. 部署完成后会得到一个 `*.pages.dev` 的 HTTPS 地址

### 方式 2：直接上传静态产物

1. 本地执行 `npm run build`
2. 上传 `dist/` 目录到静态托管平台
3. 部署后获得 HTTPS 地址

## 手机安装说明

### Android

在 HTTPS 地址下，用 Chrome 打开后：

- 若浏览器支持，会看到“安装到手机桌面”入口
- 也可以通过浏览器菜单添加到主屏幕

### iPhone

iOS 一般不走标准 `beforeinstallprompt` 流程，通常需要：

1. 用 Safari 打开 HTTPS 地址
2. 点击分享
3. 选择“添加到主屏幕”

## 为什么本地局域网不等于真正安装体验

本地局域网地址更适合调试页面本身，但如果想更稳定地测试：

- Service Worker
- 安装入口
- 添加到主屏幕
- PWA 缓存

最好还是通过正式 HTTPS 地址测试。

## 推荐的部署顺序

1. 先部署到 `pages.dev` 测通
2. 再在手机上实际安装测试
3. 确认图标、启动页、离线壳没问题
4. 有需要再绑定自定义域名

## 自定义域名建议

后续如果想更像正式产品，可以绑定类似：

- `life.xxx.com`
- `app.xxx.com`

这样手机安装后的观感会更自然。

## 当前项目的部署命令

本地开发：

`npm run dev`

构建产物：

`npm run build`

## 当前限制

- 现在还没有后端
- 数据主要保存在本地浏览器
- 多设备同步还没做
- iPhone 的安装方式仍受 Safari 限制

## 下一步可继续做

1. 绑定自定义域名
2. 增强离线缓存策略
3. 增加部署平台专用配置
4. 做首次安装引导
5. 做本地数据导出 / 导入
