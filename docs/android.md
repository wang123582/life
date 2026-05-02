# Android 封装说明

当前项目已经接入 Capacitor，并生成了 `android/` 原生工程。

## 现在已经做到的

- 保留现有 React + Vite 页面逻辑
- 通过 Capacitor 把 Web 应用封装成 Android App 工程
- 已生成 `android/` 目录
- 已配置 `capacitor.config.ts`
- 已生成 Android 图标与启动页资源
- 已补上 Android 主题颜色资源与启动后主题切换
- 已把输入法弹出时的页面适配改为 `adjustResize`，减少表单被键盘顶住的问题
- 已在项目内准备本地 `JDK 21`（`/.tools/jdk-21`）
- 也保留了一份本地 `JDK 17`（`/.tools/jdk-17`）作为回退
- 已在项目内准备本地 Android SDK（`/.tools/android-sdk`）
- Android 相关脚本会优先使用这个本地 JDK 21，不再依赖系统默认的 Java 11
- Android 相关脚本也会优先使用这个本地 Android SDK，不再依赖系统全局 `ANDROID_HOME`
- 已补充以下脚本：
  - `npm run android:sync`
  - `npm run android:open`
  - `npm run android:run`
  - `npm run android:apk:debug`
  - `npm run android:apk:release`
  - `npm run android:bundle:release`

## Java 现在怎么处理

系统默认还是 `Java 11`，但当前这套 Capacitor Android 工程实际要求的是 `Java 21`。

所以项目内现在已经单独放了：

- `life/.tools/jdk-21`
- `life/.tools/jdk-17`（回退）

所以现在这些命令会自动优先使用项目里的 JDK 21：

如果 `JDK 21` 不存在，才会回退到项目里的 `JDK 17`。

- `npm run android:open`
- `npm run android:run`
- `npm run android:apk:debug`
- `npm run android:apk:release`
- `npm run android:bundle:release`

这样做的好处是：

- 不用改系统全局 Java
- 不用 sudo
- 这个项目自己就能把 Android 打包环境带上

## 当前最新状态

- `Web build` 已通过
- `Capacitor sync android` 已通过
- 已修掉一轮 Kotlin 标准库重复依赖冲突
- 已加入项目内本地 Android 仓库代理，专门绕过这台机器当前的 DNS 解析问题
- `npm run android:apk:debug` 已成功跑通
- 已成功产出调试安装包：`android/app/build/outputs/apk/debug/app-debug.apk`
- 已把站点下载用的 APK 重新压回约 `4.7 MB`，不再把历史下载包再次打进 APK 里

换句话说，现在这条链路已经从“有 Android 工程”推进到了“能在当前机器上真正打出 debug APK”。

## Android SDK 现在怎么处理

项目内现在也已经放了一份本地 Android SDK：

- `life/.tools/android-sdk`

并且已经安装了这些关键包：

- `platform-tools`
- `platforms;android-35`
- `build-tools;35.0.0`

同时还写入了：

- `android/local.properties`

所以 Gradle 现在能直接找到 SDK，不再卡在 `SDK location not found`。

## 以后常用的命令

### 1. Web 改完后同步到 Android 工程

```bash
npm run android:sync
```

这个命令会先重新构建 Web，再把最新页面同步到 Android 工程里。

### 2. 用 Android Studio 打开原生工程

```bash
npm run android:open
```

执行后会尝试打开 `android/` 工程。

### 3. 直接运行到安卓设备（需要本机环境完整）

```bash
npm run android:run
```

前提仍然是：

- Android Studio 已安装
- 项目内 JDK 21 / JDK 17 可正常使用
- Android SDK 可用

## 打包 APK / AAB 的方式

如果你只是想直接在手机安装，优先先打开这个下载页：

- <https://life-50r.pages.dev/android-download.html>

下载页会先提醒你不要在微信 / QQ / 飞书等内置浏览器里直接下 APK。

推荐 APK 直链仍然是：

- <https://life-50r.pages.dev/downloads/life-android.apk>

旧调试链接仍保留，但新的 `life-android.apk` 更适合直接下载。

推荐用 Android Studio：

1. 打开 `android/`
2. 等 Gradle 同步完成
3. 连接安卓手机，或打开模拟器
4. 点击运行按钮测试
5. 如果要导出安装包：
   - `Build > Build Bundle(s) / APK(s) > Build APK(s)`
   - 或 `Build > Generate Signed Bundle / APK`

如果你想直接用命令行：

```bash
npm run android:apk:debug
```

正式包：

```bash
npm run android:apk:release
npm run android:bundle:release
```

## 你现在最需要记住的一句

以后只要页面改了，就先执行：

```bash
npm run android:sync
```

然后再去 Android Studio 里运行或打包。

## 这轮额外处理的安卓细节

- 修复了 Android 主题里引用颜色但缺少资源文件的问题
- 让 Splash 结束后明确切回 App 正常主题，而不是停留在启动主题上
- 优化了大量输入框场景下的键盘顶起行为，减少输入时被挡住
- 在项目内放置 JDK 17，并让 Android 命令自动优先使用它
- 在项目内放置 Android SDK，并让 Gradle 与命令行自动优先使用它
- 加入了项目内本地 Maven 仓库与 HTTP 代理，专门绕过当前机器的 DNS 解析问题
- 已打出调试包：`android/app/build/outputs/apk/debug/app-debug.apk`
