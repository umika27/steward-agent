/**
 * DEVELOPMENT-ONLY MOCK VISION PROVIDER
 * Local Room Wallpaper Perception Mapping
 *
 * Deterministically maps local static wallpapers from /Settings/ to their
 * corresponding room objects and broken appliance cases.
 * ZERO AI image generation, ZERO external API calls.
 */

import { IVisionProvider } from './visionProviderInterface';
import { LOCAL_ROOM_SCENES } from '../roomWallpaperManager';

export class MockDevVisionProvider extends IVisionProvider {
  async analyzeImage(imageSource) {
    await new Promise((resolve) => setTimeout(resolve, 60));

    const imageWidth = 1920;
    const imageHeight = 1080;
    const srcStr = String(imageSource || '').toLowerCase();

    // Match against predefined local room wallpaper scenes
    const matchedScene =
      LOCAL_ROOM_SCENES.find((scene) => {
        const wp = scene.wallpaper.toLowerCase();
        const baseName = wp.split('/').pop().replace('.jpg', '');
        return srcStr.includes(baseName) || srcStr.includes(scene.id.toLowerCase());
      }) || LOCAL_ROOM_SCENES[0];

    return {
      width: imageWidth,
      height: imageHeight,
      detections: matchedScene.objects,
    };
  }
}
