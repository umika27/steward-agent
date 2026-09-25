import React from 'react';
import { REPLACEMENT_OPTIONS } from './environmentObjects';
import { ShoppingCart, Check } from 'lucide-react';
import './PurchaseOptions.css';

/**
 * PurchaseOptions Component
 *
 * Compact visual option selector integrated directly into the interaction area.
 */
export const PurchaseOptions = ({ onSelectOption }) => {
  return (
    <div className="purchase-options-container fade-in">
      <div className="purchase-options-list">
        {REPLACEMENT_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="purchase-option-card"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectOption) onSelectOption(item);
            }}
          >
            <div className="purchase-option-tag">{item.tag}</div>
            <div className="purchase-option-info">
              <span className="purchase-option-name">{item.name}</span>
              <span className="purchase-option-price">{item.price}</span>
            </div>
            <div className="purchase-select-btn">
              <ShoppingCart size={13} />
              <span>Select</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
