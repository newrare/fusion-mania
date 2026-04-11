import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import gameConfig from './configs/game-config.js';

// On Capacitor native (Android/iOS), window.close() is a no-op — override it
// to properly exit the app when the user taps the exit button.
if (Capacitor.isNativePlatform()) {
  window.close = () => App.exitApp();
}

const game = new Phaser.Game(gameConfig);

export default game;
