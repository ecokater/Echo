import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(rootDir, "android");
const isWindows = process.platform === "win32";

const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const gradleCmd = isWindows ? "gradlew.bat" : "./gradlew";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const mode = args.has("--bundle")
  ? "bundle"
  : args.has("--release")
    ? "release"
    : "debug";

const gradleTask = {
  debug: "assembleDebug",
  release: "assembleRelease",
  bundle: "bundleRelease",
}[mode];

const outputHint = {
  debug: "android/app/build/outputs/apk/debug/app-debug.apk",
  release: "android/app/build/outputs/apk/release/app-release-unsigned.apk",
  bundle: "android/app/build/outputs/bundle/release/app-release.aab",
}[mode];

const PLACEHOLDER_API_HOST = "api.your-domain.com";

function configureAndroidApiEnvironment() {
  if (mode === "debug") {
    if (!process.env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL.includes(PLACEHOLDER_API_HOST)) {
      process.env.VITE_API_BASE_URL = "http://10.0.2.2:8000";
    }
    if (!process.env.VITE_WS_BASE_URL || process.env.VITE_WS_BASE_URL.includes(PLACEHOLDER_API_HOST)) {
      process.env.VITE_WS_BASE_URL = "ws://10.0.2.2:8000";
    }
    console.log(`Android debug API: ${process.env.VITE_API_BASE_URL}`);
    return;
  }

  if (!process.env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL.includes(PLACEHOLDER_API_HOST)) {
    console.error("Release Android builds require a real public API endpoint.");
    console.error("Set VITE_API_BASE_URL=https://your-api-domain and rebuild.");
    process.exit(1);
  }
}

function run(command, commandArgs, options = {}) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}`);
  const useShell = isWindows && /\.(cmd|bat)$/i.test(command);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? rootDir,
    stdio: "inherit",
    shell: useShell,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: "ignore",
    shell: false,
    env: process.env,
  });
  return result.status === 0;
}

function prependPath(dir) {
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH ?? ""}`;
}

function firstExisting(paths) {
  return paths.find((candidate) => candidate && existsSync(candidate));
}

function configureDefaultAndroidEnvironment() {
  if (process.env.JAVA_HOME) {
    const javaBin = path.join(process.env.JAVA_HOME, "bin");
    if (existsSync(path.join(javaBin, isWindows ? "java.exe" : "java"))) {
      prependPath(javaBin);
    }
  }

  if (isWindows && !hasCommand("java", ["-version"])) {
    const localAppData = process.env.LOCALAPPDATA;
    const javaExe = firstExisting([
      localAppData && path.join(localAppData, "Programs", "Android Studio", "jbr", "bin", "java.exe"),
      localAppData && path.join(localAppData, "Google", "AndroidStudio", "jbr", "bin", "java.exe"),
      localAppData && path.join(localAppData, "Google", "AndroidStudio2025.3.4", "jbr", "bin", "java.exe"),
      path.join("C:", "Program Files", "Android Studio", "jbr", "bin", "java.exe"),
      path.join("C:", "Program Files", "Android Studio", "jre", "bin", "java.exe"),
      path.join("C:", "Program Files", "Android", "Android Studio", "jbr", "bin", "java.exe"),
      path.join("C:", "Program Files", "Android", "Android Studio", "jre", "bin", "java.exe"),
      path.join("C:", "software", "Android studio", "jbr", "bin", "java.exe"),
      path.join("C:", "software", "Android Studio", "jbr", "bin", "java.exe"),
    ]);

    if (javaExe) {
      const javaHome = path.dirname(path.dirname(javaExe));
      process.env.JAVA_HOME = javaHome;
      prependPath(path.dirname(javaExe));
    }
  }

  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    const defaultSdk = isWindows && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : path.join(process.env.HOME ?? "", "Android", "Sdk");

    if (existsSync(defaultSdk)) {
      process.env.ANDROID_HOME = defaultSdk;
      process.env.ANDROID_SDK_ROOT = defaultSdk;
    }
  }
}

function assertAndroidEnvironment() {
  configureDefaultAndroidEnvironment();

  if (!existsSync(androidDir)) {
    console.error("Missing android/ project. Run `npx cap add android` first.");
    process.exit(1);
  }

  if (!existsSync(path.join(androidDir, isWindows ? "gradlew.bat" : "gradlew"))) {
    console.error("Missing Android Gradle wrapper under android/.");
    process.exit(1);
  }

  if (!hasCommand("java", ["-version"])) {
    console.error("Java/JDK is not available.");
    console.error("Install Android Studio or JDK 17, then ensure `java -version` works in this shell.");
    console.error("If Android Studio is installed, locate its `jbr` directory and set `JAVA_HOME` to that path.");
    process.exit(1);
  }

  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!androidHome) {
    console.error("ANDROID_HOME or ANDROID_SDK_ROOT is not set.");
    console.error("Install Android Studio SDK components, then set one of them to the Android SDK path.");
    console.error("On Windows, the default SDK path is usually `%LOCALAPPDATA%\\Android\\Sdk`.");
    process.exit(1);
  }
}

assertAndroidEnvironment();
if (checkOnly) {
  console.log("Android build environment looks ready.");
  process.exit(0);
}

configureAndroidApiEnvironment();
run(npmCmd, ["run", "build"]);
run(npxCmd, ["cap", "sync", "android"]);
run(path.join(androidDir, gradleCmd), [gradleTask], { cwd: androidDir });

console.log(`\nAndroid ${mode} build complete: ${outputHint}`);
