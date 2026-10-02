/**
 * DEVELOPMENT-ONLY MOCK VISION PROVIDER
 * Phase 12B Hotfix — Dynamic Scene Detection Output
 *
 * Simulates object and condition detection for all 5 synthetic mock environments.
 * Guarantees every generated scene contains exactly ONE broken/malfunctioning object,
 * multiple normal objects, a document/manual, and a telephone.
 */

import { IVisionProvider } from './visionProviderInterface';
import { OBJECT_CATEGORIES } from '../sceneTypes';

export class MockDevVisionProvider extends IVisionProvider {
  async analyzeImage(imageSource) {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const imageWidth = 1920;
    const imageHeight = 1080;
    const srcStr = String(imageSource || '');

    let rawDetections = [];

    if (srcStr.includes('SCENE%202') || srcStr.includes('kitchen')) {
      // SCENE 2: Kitchen Appliance Suite
      rawDetections = [
        {
          id: 'det_refrigerator_01',
          label: 'Refrigerator',
          category: OBJECT_CATEGORIES.APPLIANCES,
          confidence: 0.95,
          condition: 'DAMAGED',
          conditionConfidence: 0.94,
          box: [0.48, 0.11, 0.76, 0.23],
        },
        {
          id: 'det_cabinet_01',
          label: 'Kitchen Cabinet',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.93,
          condition: 'NORMAL',
          conditionConfidence: 0.95,
          box: [0.30, 0.75, 0.74, 0.90],
        },
        {
          id: 'det_table_01',
          label: 'Dining Table',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.94,
          condition: 'NORMAL',
          conditionConfidence: 0.96,
          box: [0.61, 0.36, 0.76, 0.62],
        },
        {
          id: 'det_telephone_01',
          label: 'Telephone',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.90,
          condition: 'NORMAL',
          conditionConfidence: 0.92,
          box: [0.56, 0.39, 0.62, 0.45],
        },
        {
          id: 'det_recipe_guide_01',
          label: 'User Manual',
          category: OBJECT_CATEGORIES.DOCUMENTS,
          confidence: 0.91,
          condition: 'NORMAL',
          conditionConfidence: 0.93,
          box: [0.55, 0.51, 0.61, 0.57],
        },
        {
          id: 'det_pendant_01',
          label: 'Ceiling Light',
          category: OBJECT_CATEGORIES.DECOR_LIGHTING,
          confidence: 0.92,
          condition: 'NORMAL',
          conditionConfidence: 0.96,
          box: [0.10, 0.45, 0.25, 0.55],
        },
      ];
    } else if (srcStr.includes('SCENE%203') || srcStr.includes('workshop')) {
      // SCENE 3: Tech Workshop Suite
      rawDetections = [
        {
          id: 'det_3d_printer_01',
          label: '3D Printer',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.92,
          condition: 'MALFUNCTIONING',
          conditionConfidence: 0.91,
          box: [0.48, 0.11, 0.76, 0.23],
        },
        {
          id: 'det_workbench_01',
          label: 'Executive Desk',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.95,
          condition: 'NORMAL',
          conditionConfidence: 0.96,
          box: [0.61, 0.36, 0.76, 0.62],
        },
        {
          id: 'det_office_chair_01',
          label: 'Office Chair',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.93,
          condition: 'NORMAL',
          conditionConfidence: 0.94,
          box: [0.52, 0.28, 0.72, 0.38],
        },
        {
          id: 'det_telephone_01',
          label: 'Telephone',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.89,
          condition: 'NORMAL',
          conditionConfidence: 0.90,
          box: [0.56, 0.39, 0.62, 0.45],
        },
        {
          id: 'det_tech_guide_01',
          label: 'Technical Manual',
          category: OBJECT_CATEGORIES.DOCUMENTS,
          confidence: 0.90,
          condition: 'NORMAL',
          conditionConfidence: 0.92,
          box: [0.55, 0.51, 0.61, 0.57],
        },
        {
          id: 'det_cupboard_01',
          label: 'Tool Cabinet',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.94,
          condition: 'NORMAL',
          conditionConfidence: 0.95,
          box: [0.30, 0.75, 0.74, 0.90],
        },
      ];
    } else if (srcStr.includes('SCENE%204') || srcStr.includes('lounge')) {
      // SCENE 4: Living Lounge Suite
      rawDetections = [
        {
          id: 'det_tv_01',
          label: 'Television',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.94,
          condition: 'DAMAGED',
          conditionConfidence: 0.93,
          box: [0.48, 0.11, 0.76, 0.23],
        },
        {
          id: 'det_sofa_01',
          label: 'Lounge Sofa',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.96,
          condition: 'NORMAL',
          conditionConfidence: 0.97,
          box: [0.55, 0.44, 0.82, 0.95],
        },
        {
          id: 'det_coffee_table_01',
          label: 'Coffee Table',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.94,
          condition: 'NORMAL',
          conditionConfidence: 0.95,
          box: [0.61, 0.36, 0.76, 0.62],
        },
        {
          id: 'det_telephone_01',
          label: 'Telephone',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.88,
          condition: 'NORMAL',
          conditionConfidence: 0.90,
          box: [0.56, 0.39, 0.62, 0.45],
        },
        {
          id: 'det_user_guide_01',
          label: 'User Guide',
          category: OBJECT_CATEGORIES.DOCUMENTS,
          confidence: 0.92,
          condition: 'NORMAL',
          conditionConfidence: 0.94,
          box: [0.55, 0.51, 0.61, 0.57],
        },
        {
          id: 'det_lamp_01',
          label: 'Floor Lamp',
          category: OBJECT_CATEGORIES.DECOR_LIGHTING,
          confidence: 0.95,
          condition: 'NORMAL',
          conditionConfidence: 0.96,
          box: [0.31, 0.29, 0.68, 0.41],
        },
      ];
    } else if (srcStr.includes('SCENE%205') || srcStr.includes('studio')) {
      // SCENE 5: Appliance Studio Suite
      rawDetections = [
        {
          id: 'det_microwave_01',
          label: 'Microwave',
          category: OBJECT_CATEGORIES.APPLIANCES,
          confidence: 0.93,
          condition: 'MALFUNCTIONING',
          conditionConfidence: 0.92,
          box: [0.48, 0.11, 0.76, 0.23],
        },
        {
          id: 'det_worktable_01',
          label: 'Work Table',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.95,
          condition: 'NORMAL',
          conditionConfidence: 0.96,
          box: [0.61, 0.36, 0.76, 0.62],
        },
        {
          id: 'det_telephone_01',
          label: 'Telephone',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.90,
          condition: 'NORMAL',
          conditionConfidence: 0.91,
          box: [0.56, 0.39, 0.62, 0.45],
        },
        {
          id: 'det_instruction_book_01',
          label: 'Instruction Manual',
          category: OBJECT_CATEGORIES.DOCUMENTS,
          confidence: 0.91,
          condition: 'NORMAL',
          conditionConfidence: 0.93,
          box: [0.55, 0.51, 0.61, 0.57],
        },
        {
          id: 'det_shelf_01',
          label: 'Storage Shelf',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.94,
          condition: 'NORMAL',
          conditionConfidence: 0.95,
          box: [0.30, 0.75, 0.74, 0.90],
        },
      ];
    } else {
      // DEFAULT / SCENE 1: Laundry & Utility Suite
      rawDetections = [
        {
          id: 'det_washing_machine_01',
          label: 'Washing Machine',
          category: OBJECT_CATEGORIES.APPLIANCES,
          confidence: 0.92,
          condition: 'MALFUNCTIONING',
          conditionConfidence: 0.90,
          box: [0.48, 0.11, 0.76, 0.23],
        },
        {
          id: 'det_sofa_01',
          label: 'Sofa',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.96,
          condition: 'NORMAL',
          conditionConfidence: 0.95,
          box: [0.55, 0.44, 0.82, 0.95],
        },
        {
          id: 'det_coffee_table_01',
          label: 'Coffee Table',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.94,
          condition: 'NORMAL',
          conditionConfidence: 0.92,
          box: [0.61, 0.36, 0.76, 0.62],
        },
        {
          id: 'det_telephone_01',
          label: 'Telephone',
          category: OBJECT_CATEGORIES.ELECTRONICS,
          confidence: 0.86,
          condition: 'NORMAL',
          conditionConfidence: 0.90,
          box: [0.56, 0.39, 0.62, 0.45],
        },
        {
          id: 'det_user_manual_01',
          label: 'User Manual',
          category: OBJECT_CATEGORIES.DOCUMENTS,
          confidence: 0.90,
          condition: 'NORMAL',
          conditionConfidence: 0.95,
          box: [0.55, 0.51, 0.61, 0.57],
        },
        {
          id: 'det_cupboard_01',
          label: 'Storage Cupboard',
          category: OBJECT_CATEGORIES.FURNITURE,
          confidence: 0.93,
          condition: 'NORMAL',
          conditionConfidence: 0.94,
          box: [0.30, 0.75, 0.74, 0.90],
        },
      ];
    }

    return {
      width: imageWidth,
      height: imageHeight,
      detections: rawDetections,
    };
  }
}
