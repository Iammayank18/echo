const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

exports.default = async function (context) {
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  const entitlements = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');

  console.log(`  • ad-hoc signing with entitlements  app=${appPath}`);

  // Sign fn-helper binary
  const fnHelper = `${appPath}/Contents/Resources/fn-helper`;
  try {
    await execAsync(`codesign --force --sign - --entitlements "${entitlements}" "${fnHelper}"`);
  } catch {}

  // Deep-sign the entire app bundle (handles all nested frameworks, dylibs, helpers)
  await execAsync(`codesign --deep --force --sign - --entitlements "${entitlements}" "${appPath}"`);

  console.log('  • ad-hoc signing with entitlements complete');
};
