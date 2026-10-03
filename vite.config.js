import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Local Room Wallpaper Setup (public/Settings)
const userImg = 'C:/Users/karti/.gemini/antigravity-ide/brain/f22b9b17-81f4-4a32-9f34-1ebb7d7a0c12/.user_uploaded/media_1791049898243.jpg';
const fallbackImg = path.resolve(__dirname, 'src/assets/living-room-bg.jpg');
const sourceImg = fs.existsSync(userImg) ? userImg : fallbackImg;

const settingsDir = path.resolve(__dirname, 'public/Settings');
if (!fs.existsSync(settingsDir)) {
  try {
    fs.mkdirSync(settingsDir, { recursive: true });
  } catch (_) {}
}

const wallpapers = [
  'washing_machine.jpg',
  'television.jpg',
  'refrigerator.jpg',
  'microwave.jpg'
];

wallpapers.forEach((filename) => {
  const destPath = path.join(settingsDir, filename);
  if (fs.existsSync(sourceImg) && !fs.existsSync(destPath)) {
    try {
      fs.copyFileSync(sourceImg, destPath);
    } catch (_) {}
  }
});

const destAsset = path.resolve(__dirname, 'src/assets/living-room-bg.jpg');
if (fs.existsSync(sourceImg)) {
  try {
    fs.copyFileSync(sourceImg, destAsset);
  } catch (_) {}
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-settings-wallpapers',
      buildStart() {
        if (fs.existsSync(settingsDir)) {
          wallpapers.forEach((filename) => {
            const destPath = path.join(settingsDir, filename);
            if (fs.existsSync(sourceImg) && !fs.existsSync(destPath)) {
              try {
                fs.copyFileSync(sourceImg, destPath);
              } catch (_) {}
            }
          });
        }
      },
      configureServer() {
        if (fs.existsSync(settingsDir)) {
          wallpapers.forEach((filename) => {
            const destPath = path.join(settingsDir, filename);
            if (fs.existsSync(sourceImg) && !fs.existsSync(destPath)) {
              try {
                fs.copyFileSync(sourceImg, destPath);
              } catch (_) {}
            }
          });
        }
      }
    }
  ],
  server: {
    port: 3000,
    open: false
  }
});
