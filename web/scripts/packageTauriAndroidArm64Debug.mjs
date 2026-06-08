import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const webDir = path.join(repoRoot, 'web');
const tauriDir = path.join(repoRoot, 'src-tauri');
const androidDir = path.join(tauriDir, 'gen/android');
const assetsDir = path.join(androidDir, 'app/src/main/assets');
const jniDir = path.join(androidDir, 'app/src/main/jniLibs/arm64-v8a');
const androidResDir = path.join(androidDir, 'app/src/main/res');
const androidIconsDir = path.join(tauriDir, 'icons/android');
const androidManifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
const mainActivityPath = path.join(androidDir, 'app/src/main/java/life/marlon/todo/MainActivity.kt');
const libName = 'libtodo_desktop_lib.so';
const nativeLib = path.join(tauriDir, 'target/aarch64-linux-android/debug', libName);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const androidHome = process.env.ANDROID_HOME
  || process.env.ANDROID_SDK_ROOT
  || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android/Sdk') : '');
const javaHome = process.env.JAVA_HOME
  || (process.platform === 'win32' && existsSync('D:/AndroidStudio/jbr') ? 'D:/AndroidStudio/jbr' : '');
const ndkRoot = androidHome ? path.join(androidHome, 'ndk') : '';
const ndkHome = process.env.ANDROID_NDK_HOME
  || process.env.NDK_HOME
  || (existsSync(ndkRoot) ? path.join(ndkRoot, readdirSync(ndkRoot).sort().at(-1) || '') : '');
const pathParts = [
  process.platform === 'win32' && process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.cargo/bin') : '',
  javaHome ? path.join(javaHome, 'bin') : '',
  androidHome ? path.join(androidHome, 'platform-tools') : '',
  androidHome ? path.join(androidHome, 'cmdline-tools/latest/bin') : '',
  process.env.Path || process.env.PATH || '',
].filter(Boolean);
const buildEnv = {
  ...process.env,
  Path: pathParts.join(path.delimiter),
  PATH: pathParts.join(path.delimiter),
  ...(javaHome ? { JAVA_HOME: javaHome } : {}),
  ...(androidHome ? { ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome } : {}),
  ...(ndkHome ? { ANDROID_NDK_HOME: ndkHome, NDK_HOME: ndkHome } : {}),
};

function run(command, args, options = {}, allowFailure = false) {
  const result = spawnSync(command, args, {
    env: buildEnv,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

function syncAndroidIcons() {
  if (!existsSync(androidIconsDir)) return;
  mkdirSync(androidResDir, { recursive: true });
  for (const entry of readdirSync(androidIconsDir, { withFileTypes: true })) {
    const source = path.join(androidIconsDir, entry.name);
    const destination = path.join(androidResDir, entry.name);
    if (entry.isDirectory()) {
      cpSync(source, destination, { recursive: true, force: true });
    } else {
      copyFileSync(source, destination);
    }
  }

  if (existsSync(androidManifestPath)) {
    const manifest = readFileSync(androidManifestPath, 'utf8');
    const nextManifest = manifest.replace(/    <application\b[\s\S]*?>/, (applicationTag) => {
      const themeAttr = applicationTag.match(/android:theme="[^"]+"/)?.[0] || 'android:theme="@style/Theme.todo_desktop"';
      const cleartextAttr = applicationTag.match(/android:usesCleartextTraffic="[^"]+"/)?.[0]
        || 'android:usesCleartextTraffic="${usesCleartextTraffic}"';
      return [
        '    <application',
        '        android:icon="@mipmap/ic_launcher"',
        '        android:roundIcon="@mipmap/ic_launcher_round"',
        '        android:label="@string/app_name"',
        `        ${themeAttr}`,
        `        ${cleartextAttr}>`,
      ].join('\n');
    });
    if (nextManifest !== manifest) {
      writeFileSync(androidManifestPath, nextManifest);
    }
  }
}

function ensureAndroidNativeShell() {
  mkdirSync(path.dirname(mainActivityPath), { recursive: true });
  const source = `package life.marlon.todo

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.decorView.setBackgroundColor(Color.WHITE)
    window.statusBarColor = Color.WHITE
    window.navigationBarColor = Color.WHITE
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
    }
    WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = true
    WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightNavigationBars = true
    super.onCreate(savedInstanceState)
    applySystemBarInsets()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.setBackgroundColor(Color.WHITE)
  }

  private fun applySystemBarInsets() {
    val content = findViewById<View>(android.R.id.content) ?: return
    content.setBackgroundColor(Color.WHITE)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val systemBars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
      insets
    }
    ViewCompat.requestApplyInsets(content)
    content.postDelayed({ ViewCompat.requestApplyInsets(content) }, 250)
    content.postDelayed({ ViewCompat.requestApplyInsets(content) }, 1000)
  }
}
`;
  if (!existsSync(mainActivityPath) || readFileSync(mainActivityPath, 'utf8') !== source) {
    writeFileSync(mainActivityPath, source);
  }
}

run(npmCommand, ['run', 'build:desktop'], {
  cwd: webDir,
  env: {
    ...buildEnv,
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'https://todo.marlon.life/api',
  },
});

const tauriStatus = run(npmCommand, ['run', 'tauri', '--', 'android', 'build', '--debug', '--target', 'aarch64'], {
  cwd: webDir,
}, true);

if (!existsSync(nativeLib)) {
  process.exit(tauriStatus);
}

syncAndroidIcons();
ensureAndroidNativeShell();

rmSync(assetsDir, { recursive: true, force: true });
mkdirSync(assetsDir, { recursive: true });
if (process.platform === 'win32') {
  const copyStatus = spawnSync('robocopy', [path.join(webDir, 'dist'), assetsDir, '/E'], {
    cwd: repoRoot,
    env: buildEnv,
    stdio: 'inherit',
  }).status ?? 1;
  if (copyStatus > 7) process.exit(copyStatus);
} else {
  run('cp', ['-R', `${path.join(webDir, 'dist')}/.`, assetsDir], { cwd: repoRoot });
}

mkdirSync(jniDir, { recursive: true });
copyFileSync(nativeLib, path.join(jniDir, libName));

run(gradleCommand, ['assembleArm64Debug', '-x', 'rustBuildArm64Debug', '--rerun-tasks'], {
  cwd: androidDir,
});
