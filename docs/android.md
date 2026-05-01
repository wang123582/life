# Android 封装说明

当前项目已经接入 Capacitor，并生成了 `android/` 原生工程。

## 现在已经做到的

- 保留现有 React + Vite 页面逻辑
- 通过 Capacitor 把 Web 应用封装成 Android App 工程
- 已生成 `android/` 目录
- 已配置 `capacitor.config.ts`
- 已生成 Android 图标与启动页资源
- 已补充以下脚本：
  - `npm run android:sync`
  - `npm run android:open`
  - `npm run android:run`
  - `npm run android:apk:debug`
  - `npm run android:apk:release`
  - `npm run android:bundle:release`

## 当前打包阻塞点

我已经尝试过直接打 Debug APK，但当前环境卡在 **Java 版本**：

- Android Gradle Plugin 需要 **Java 17**
- 当前机器只有 **Java 11**

也就是说：

- 工程已经准备好了
- 图标和启动页也已经进了 Android 工程
- 但要真正跑出 APK，还需要把本机 JDK 升到 17

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
- Java 17 可用
- Android SDK 可用

## 打包 APK / AAB 的方式

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
