const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

module.exports = function withWebRtcScreenSharing(config) {
  config = withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    manifest['uses-permission'] ??= [];
    const permissions = new Set(
      (manifest['uses-permission'] ?? []).map((item) => item.$['android:name']),
    );
    for (const permission of [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
    ]) {
      if (!permissions.has(permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    }
    return configWithManifest;
  });

  config = withMainApplication(config, (configWithApplication) => {
    const source = configWithApplication.modResults.contents;
    const enableScreenCapture =
      'com.oney.WebRTCModule.WebRTCModuleOptions.getInstance().enableMediaProjectionService = true';
    if (!source.includes('enableMediaProjectionService = true')) {
      if (!source.includes('super.onCreate()')) {
        throw new Error('Could not configure WebRTC screen capture: MainApplication.onCreate() was not found.');
      }
      configWithApplication.modResults.contents = source.includes('super.onCreate();')
        ? source.replace(
            'super.onCreate();',
            `super.onCreate();\n    ${enableScreenCapture};`,
          )
        : source.replace('super.onCreate()', `super.onCreate()\n    ${enableScreenCapture}`);
    }
    return configWithApplication;
  });

  return config;
};
