/**
 * Local Room Wallpaper Manager Module
 *
 * Provides local static household wallpapers from /Settings/ without any
 * AI image generation or external vision API calls.
 * Associates each room wallpaper with a deterministic case & broken object.
 */

import { OBJECT_CATEGORIES } from './sceneTypes';

export const LOCAL_ROOM_SCENES = [
  {
    id: 'SCENE_WASHING_MACHINE',
    title: 'Modern Living Room & Utility Suite',
    wallpaper: '/Settings/washing_machine.jpg',
    brokenObject: {
      id: 'det_washing_machine_01',
      label: 'Washing Machine',
      category: OBJECT_CATEGORIES.APPLIANCES,
      condition: 'MALFUNCTIONING',
      conditionConfidence: 0.95,
      normalizedBoundingBox: [0.52, 0.79, 0.90, 0.98],
      issueDescription: 'The drum is stuck and a water leak alarm is active.',
      serviceType: 'Bosch Express Care',
      quoteAmount: '₹900',
    },
    objects: [
      {
        id: 'det_washing_machine_01',
        label: 'Washing Machine',
        category: OBJECT_CATEGORIES.APPLIANCES,
        confidence: 0.94,
        condition: 'MALFUNCTIONING',
        conditionConfidence: 0.95,
        box: [0.52, 0.79, 0.90, 0.98],
      },
      {
        id: 'det_sofa_01',
        label: 'Sofa',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.96,
        condition: 'NORMAL',
        box: [0.50, 0.38, 0.84, 0.72],
      },
      {
        id: 'det_coffee_table_01',
        label: 'Coffee Table',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.95,
        condition: 'NORMAL',
        box: [0.60, 0.26, 0.83, 0.41],
      },
      {
        id: 'det_user_manual_01',
        label: 'User Manual',
        category: OBJECT_CATEGORIES.DOCUMENTS,
        confidence: 0.92,
        condition: 'NORMAL',
        box: [0.62, 0.28, 0.68, 0.36],
      },
      {
        id: 'det_cupboard_01',
        label: 'Storage Cupboard',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.94,
        condition: 'NORMAL',
        box: [0.24, 0.16, 0.69, 0.39],
      },
      {
        id: 'det_tv_01',
        label: 'Television',
        category: OBJECT_CATEGORIES.ELECTRONICS,
        confidence: 0.93,
        condition: 'NORMAL',
        box: [0.28, 0.03, 0.88, 0.16],
      },
      {
        id: 'det_telephone_01',
        label: 'Telephone',
        category: OBJECT_CATEGORIES.ELECTRONICS,
        confidence: 0.88,
        condition: 'NORMAL',
        box: [0.60, 0.04, 0.67, 0.11],
      },
    ],
  },
  {
    id: 'SCENE_TELEVISION',
    title: 'Entertainment Lounge',
    wallpaper: '/Settings/television.jpg',
    brokenObject: {
      id: 'det_tv_01',
      label: 'Television',
      category: OBJECT_CATEGORIES.ELECTRONICS,
      condition: 'MALFUNCTIONING',
      conditionConfidence: 0.93,
      normalizedBoundingBox: [0.28, 0.03, 0.88, 0.16],
      issueDescription: 'Display backlight circuit failure detected.',
      serviceType: 'Sony Authorized Support',
      quoteAmount: '₹1,100',
    },
    objects: [
      {
        id: 'det_tv_01',
        label: 'Television',
        category: OBJECT_CATEGORIES.ELECTRONICS,
        confidence: 0.95,
        condition: 'MALFUNCTIONING',
        conditionConfidence: 0.93,
        box: [0.28, 0.03, 0.88, 0.16],
      },
      {
        id: 'det_sofa_01',
        label: 'Sofa',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.96,
        condition: 'NORMAL',
        box: [0.50, 0.38, 0.84, 0.72],
      },
      {
        id: 'det_coffee_table_01',
        label: 'Coffee Table',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.95,
        condition: 'NORMAL',
        box: [0.60, 0.26, 0.83, 0.41],
      },
      {
        id: 'det_user_manual_01',
        label: 'User Manual',
        category: OBJECT_CATEGORIES.DOCUMENTS,
        confidence: 0.92,
        condition: 'NORMAL',
        box: [0.62, 0.28, 0.68, 0.36],
      },
      {
        id: 'det_telephone_01',
        label: 'Telephone',
        category: OBJECT_CATEGORIES.ELECTRONICS,
        confidence: 0.88,
        condition: 'NORMAL',
        box: [0.60, 0.04, 0.67, 0.11],
      },
    ],
  },
  {
    id: 'SCENE_REFRIGERATOR',
    title: 'Kitchen Appliance Suite',
    wallpaper: '/Settings/refrigerator.jpg',
    brokenObject: {
      id: 'det_refrigerator_01',
      label: 'Refrigerator',
      category: OBJECT_CATEGORIES.APPLIANCES,
      condition: 'MALFUNCTIONING',
      conditionConfidence: 0.94,
      normalizedBoundingBox: [0.24, 0.16, 0.69, 0.39],
      issueDescription: 'Compressor relay overheating and temperature fluctuation.',
      serviceType: 'LG Smart Care Dispatch',
      quoteAmount: '₹850',
    },
    objects: [
      {
        id: 'det_refrigerator_01',
        label: 'Refrigerator',
        category: OBJECT_CATEGORIES.APPLIANCES,
        confidence: 0.94,
        condition: 'MALFUNCTIONING',
        conditionConfidence: 0.94,
        box: [0.24, 0.16, 0.69, 0.39],
      },
      {
        id: 'det_coffee_table_01',
        label: 'Dining Table',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.95,
        condition: 'NORMAL',
        box: [0.60, 0.26, 0.83, 0.41],
      },
      {
        id: 'det_user_manual_01',
        label: 'User Manual',
        category: OBJECT_CATEGORIES.DOCUMENTS,
        confidence: 0.92,
        condition: 'NORMAL',
        box: [0.62, 0.28, 0.68, 0.36],
      },
      {
        id: 'det_telephone_01',
        label: 'Telephone',
        category: OBJECT_CATEGORIES.ELECTRONICS,
        confidence: 0.88,
        condition: 'NORMAL',
        box: [0.60, 0.04, 0.67, 0.11],
      },
    ],
  },
  {
    id: 'SCENE_MICROWAVE',
    title: 'Appliance Studio Suite',
    wallpaper: '/Settings/microwave.jpg',
    brokenObject: {
      id: 'det_microwave_01',
      label: 'Microwave',
      category: OBJECT_CATEGORIES.APPLIANCES,
      condition: 'MALFUNCTIONING',
      conditionConfidence: 0.91,
      normalizedBoundingBox: [0.60, 0.26, 0.83, 0.41],
      issueDescription: 'Turntable motor locked and magnetron sensor warning.',
      serviceType: 'Samsung Care Direct',
      quoteAmount: '₹650',
    },
    objects: [
      {
        id: 'det_microwave_01',
        label: 'Microwave',
        category: OBJECT_CATEGORIES.APPLIANCES,
        confidence: 0.93,
        condition: 'MALFUNCTIONING',
        conditionConfidence: 0.91,
        box: [0.60, 0.26, 0.83, 0.41],
      },
      {
        id: 'det_sofa_01',
        label: 'Executive Sofa',
        category: OBJECT_CATEGORIES.FURNITURE,
        confidence: 0.96,
        condition: 'NORMAL',
        box: [0.50, 0.38, 0.84, 0.72],
      },
      {
        id: 'det_user_manual_01',
        label: 'User Manual',
        category: OBJECT_CATEGORIES.DOCUMENTS,
        confidence: 0.92,
        condition: 'NORMAL',
        box: [0.62, 0.28, 0.68, 0.36],
      },
      {
        id: 'det_telephone_01',
        label: 'Telephone',
        category: OBJECT_CATEGORIES.ELECTRONICS,
        confidence: 0.88,
        condition: 'NORMAL',
        box: [0.60, 0.04, 0.67, 0.11],
      },
    ],
  },
];

export class RoomWallpaperManager {
  constructor() {
    this.currentIndex = 0;
    this.listeners = new Set();
  }

  getCurrentScene() {
    return LOCAL_ROOM_SCENES[this.currentIndex] || LOCAL_ROOM_SCENES[0];
  }

  /**
   * Randomly selects a different room wallpaper scene (avoiding consecutive repeat)
   */
  selectNextRandomScene() {
    if (LOCAL_ROOM_SCENES.length <= 1) {
      return this.getCurrentScene();
    }

    let nextIndex = this.currentIndex;
    while (nextIndex === this.currentIndex) {
      nextIndex = Math.floor(Math.random() * LOCAL_ROOM_SCENES.length);
    }

    this.currentIndex = nextIndex;
    const scene = this.getCurrentScene();
    this.notify(scene);
    return scene;
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
    return () => this.listeners.delete(callback);
  }

  notify(scene) {
    this.listeners.forEach((cb) => {
      try {
        cb(scene);
      } catch (err) {
        console.error('RoomWallpaperManager listener error:', err);
      }
    });
  }
}

export const roomWallpaperManager = new RoomWallpaperManager();
