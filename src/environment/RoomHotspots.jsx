import React from 'react';
import { ROOM_OBJECTS } from './environmentObjects';
import { Wrench, BookOpen, PhoneCall } from 'lucide-react';
import './RoomHotspots.css';

/**
 * RoomHotspots Component
 *
 * Renders subtle interactive environment hotspots over the living room scene.
 */
export const RoomHotspots = ({ onSelectObject, activeObjectId, isNavigating }) => {
  return (
    <div className="room-hotspots-layer">
      {/* Washing Machine Hotspot */}
      <div
        className={`room-hotspot washing-machine-hotspot ${
          activeObjectId === ROOM_OBJECTS.WASHING_MACHINE.id ? 'active' : ''
        } ${isNavigating ? 'disabled' : ''}`}
        style={ROOM_OBJECTS.WASHING_MACHINE.hotspot}
        onClick={() => {
          if (!isNavigating && onSelectObject) {
            onSelectObject(ROOM_OBJECTS.WASHING_MACHINE.id);
          }
        }}
        title="Inspect Washing Machine"
        role="button"
        tabIndex={0}
      >
        <div className="hotspot-pulse-ring" />
        <div className="hotspot-icon-badge">
          <Wrench size={14} />
        </div>
      </div>

      {/* Cupboard Hotspot */}
      <div
        className={`room-hotspot cupboard-hotspot ${
          activeObjectId === ROOM_OBJECTS.CUPBOARD.id ? 'active' : ''
        }`}
        style={ROOM_OBJECTS.CUPBOARD.hotspot}
        title="Storage Cupboard (Documentation)"
      >
        <div className="hotspot-pulse-ring" />
        <div className="hotspot-icon-badge">
          <BookOpen size={14} />
        </div>
      </div>

      {/* Telephone Hotspot */}
      <div
        className={`room-hotspot telephone-hotspot ${
          activeObjectId === ROOM_OBJECTS.TELEPHONE.id ? 'active' : ''
        }`}
        style={ROOM_OBJECTS.TELEPHONE.hotspot}
        title="Service Telephone"
      >
        <div className="hotspot-pulse-ring" />
        <div className="hotspot-icon-badge">
          <PhoneCall size={14} />
        </div>
      </div>
    </div>
  );
};
