/**
 * Environment Objects Configuration
 *
 * Defines interactive room objects and their target interaction coordinates
 * within the living-room background environment.
 * Coordinates are calculated relative to screen dimensions so they remain
 * responsive across viewports.
 */

export const ROOM_OBJECTS = {
  HOME: {
    id: 'home',
    name: 'Home Base',
    // Default starting position at container center
    getPosition: () => ({ x: 0, y: 0 }),
  },
  WASHING_MACHINE: {
    id: 'washing-machine',
    name: 'Washing Machine',
    // Left side of room (near balcony door)
    getPosition: (containerWidth) => ({
      x: -Math.min(containerWidth * 0.28, 280),
      y: 60,
    }),
    hotspot: {
      left: '18%',
      top: '58%',
      width: '110px',
      height: '140px',
    },
  },
  CUPBOARD: {
    id: 'cupboard',
    name: 'Storage Cupboard',
    // Right side of room (near bookshelf)
    getPosition: (containerWidth) => ({
      x: Math.min(containerWidth * 0.28, 280),
      y: -60,
    }),
    hotspot: {
      right: '16%',
      top: '36%',
      width: '120px',
      height: '160px',
    },
  },
  TELEPHONE: {
    id: 'telephone',
    name: 'Service Telephone',
    // Center table area
    getPosition: (containerWidth) => ({
      x: 0,
      y: 110,
    }),
    hotspot: {
      left: '47%',
      top: '64%',
      width: '100px',
      height: '90px',
    },
  },
};

/**
 * Purchase Options Data for Replacement Flow
 */
export const REPLACEMENT_OPTIONS = [
  { id: 'opt-1', name: 'EcoWash Silent 900', price: '$449', tag: 'Best Value' },
  { id: 'opt-2', name: 'UltraDry Pro 2000', price: '$599', tag: 'Premium' },
  { id: 'opt-3', name: 'CompactSmart X', price: '$379', tag: 'Compact' },
];
