import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export async function initNativePlugins() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f766e' });
  } catch {
    // ignore on non-native
  }

  try {
    await SplashScreen.hide();
  } catch {
    // ignore
  }
}

export function setupBackButton(onBack: () => void, canGoBack: boolean) {
  if (!Capacitor.isNativePlatform()) return;

  const listener = CapacitorApp.addListener('backButton', () => {
    if (canGoBack) {
      onBack();
    } else {
      CapacitorApp.exitApp();
    }
  });

  return listener;
}

export async function openExternalUrl(url: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url, windowName: '_system' });
    } catch {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}

export { Capacitor };
