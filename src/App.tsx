import { useState } from 'react';
import type { Settings } from './types';
import { loadSettings, saveSettings } from './lib/storage';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<'home' | 'settings'>('home');

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  return (
    <div className="h-full">
      {screen === 'home' ? (
        <HomeScreen settings={settings} onOpenSettings={() => setScreen('settings')} />
      ) : (
        <SettingsScreen settings={settings} onChange={updateSettings} onBack={() => setScreen('home')} />
      )}
    </div>
  );
}
