const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSettings(data) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

function getSetting(key, defaultValue = '') {
  const settings = loadSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

function setSetting(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

function getPttKeyLabel() {
  const key = getSetting('pttKey', 'fn');
  if (key === 'fn') return 'Fn';
  if (typeof key === 'object' && key.label) return key.label;
  const labels = { 'right-option': 'Right Option', f5: 'F5' };
  return labels[key] || 'Fn';
}

function generateProfileId() {
  return 'profile_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function migrateToProfiles() {
  const settings = loadSettings();
  if (settings.promptProfiles) return settings.promptProfiles;

  const existingPrompt = settings.customSystemPrompt || '';
  const defaultProfile = {
    name: 'Default',
    systemPrompt: existingPrompt,
    isDefault: true,
  };
  const profiles = { default: defaultProfile };

  settings.promptProfiles = profiles;
  settings.activeProfileId = 'default';
  if (!settings.autoSwitchRules) settings.autoSwitchRules = [];
  saveSettings(settings);
  return profiles;
}

function getActiveProfile(context) {
  const settings = loadSettings();
  const profiles = settings.promptProfiles || migrateToProfiles();
  const rules = settings.autoSwitchRules || [];
  const activeId = settings.activeProfileId || 'default';

  // Try auto-switch: parse app name from context (format: "AppName | WindowTitle")
  if (context && rules.length > 0) {
    const appName = context.split(' | ')[0].trim().toLowerCase();
    for (const rule of rules) {
      if (appName.includes(rule.appPattern.toLowerCase())) {
        const matched = profiles[rule.profileId];
        if (matched) return { ...matched, id: rule.profileId };
      }
    }
  }

  // Fall back to manually selected profile
  if (profiles[activeId]) return { ...profiles[activeId], id: activeId };

  // Fall back to default
  const defaultEntry = Object.entries(profiles).find(([, p]) => p.isDefault);
  if (defaultEntry) return { ...defaultEntry[1], id: defaultEntry[0] };

  // Last resort
  const firstEntry = Object.entries(profiles)[0];
  if (firstEntry) return { ...firstEntry[1], id: firstEntry[0] };

  return { id: 'default', name: 'Default', systemPrompt: '', isDefault: true };
}

module.exports = { loadSettings, saveSettings, getSetting, setSetting, getPttKeyLabel, generateProfileId, migrateToProfiles, getActiveProfile };
