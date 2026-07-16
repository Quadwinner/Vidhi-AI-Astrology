// src/components/Modal.tsx

import React, { useEffect } from 'react';
import './Modal.css'; // We will create this file next
import { IconX } from '@tabler/icons-react'; // Using a popular icon library for the close button

interface ModalProps {
  /** The content to be displayed inside the modal */
  children: React.ReactNode;
  /** Boolean to control if the modal is open or closed */
  isOpen: boolean;
  /** Function to be called when the modal should be closed (e.g., by clicking the overlay or close button) */
  onClose: () => void;
  /** An optional title to be displayed in the modal's header */
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ children, isOpen, onClose, title }) => {
  
  // Effect to handle the 'Escape' key press to close the modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    // Add event listener when the modal is open
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    // Cleanup: remove the event listener when the modal is closed or the component unmounts
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // If the modal is not open, render nothing
  if (!isOpen) {
    return null;
  }

  // Stop click propagation from the modal content to the overlay
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    // The modal-overlay is the full-screen semi-transparent background.
    // Clicking it will trigger the onClose function.
    <div className="modal-overlay" onClick={onClose}>
      
      {/* The modal-content is the main container for the content. */}
      {/* Clicking inside it will be stopped from closing the modal. */}
      <div className="modal-content" onClick={handleContentClick}>
        
        <div className="modal-header">
          {/* Render the title if it's provided */}
          {title && <h2 className="modal-title">{title}</h2>}
          
          {/* The close button */}
          <button className="modal-close-button" onClick={onClose}>
            <IconX size={24} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

      </div>
    </div>
  );
};

export default Modal;