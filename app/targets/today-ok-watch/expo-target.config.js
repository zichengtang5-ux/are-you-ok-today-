/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'TodayOkWatch',
  displayName: '今天还好',
  bundleIdentifier: '.watch',
  deploymentTarget: '9.4',
  icon: '../../assets/images/icon.png',
  frameworks: ['WatchConnectivity', 'Security'],
  images: {
    doubleBar: '../../assets/images/logo-double-bar-white-bg.png',
  },
  colors: {
    $accent: '#4CAF50',
    safetyGreen: { light: '#4CAF50', dark: '#81C784' },
    warningOrange: { light: '#F5A623', dark: '#F5A623' },
    alertRed: { light: '#E5484D', dark: '#E5484D' },
  },
};
