import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Copy generated living room background to src/assets/living-room-bg.jpg
const srcImg = 'C:/Users/karti/.gemini/antigravity-ide/brain/67a7f7e4-b788-4ed5-87ea-04866d196602/living_room_bg_1790292546749.jpg';
const destImg = path.resolve(__dirname, 'src/assets/living-room-bg.jpg');
if (fs.existsSync(srcImg)) {
  fs.copyFileSync(srcImg, destImg);
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false
  }
});

