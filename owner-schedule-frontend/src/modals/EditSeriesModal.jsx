import React, { useState } from 'react';
import Modal from 'react-modal';
import { CloseIcon } from './UIComponents'; // adjust path if needed

const EditSeriesModal = ({ isOpen, onConfirm, onCancel, editType: initialEditType }) => {
  const [editType, setEditType] = useState(initialEditType);

  const handleConfirm = () => onConfirm(editType);
  const handleCancel = () => onCancel();

  return (
    <>
      <style jsx>{`
        @keyframes fadeInScaleUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(17,24,39,0.4);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-container {
          background-color: #fff;
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          max-width: 500px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          display: flex;
          flex-direction: column;
          animation: fadeInScaleUp 0.3s ease-out forwards;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .modal-title { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0; }

        .modal-body { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-top: 24px;
          border-top: 1px solid #e2e8f0;
          padding-top: 24px;
          gap: 12px;
        }

        .close-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          transition: background-color 0.2s ease, color 0.2s ease;
          border-radius: 50%;
        }

        .close-button:hover { background-color: #f1f5f9; }

        .edit-options { display: flex; flex-direction: column; gap: 12px; }

        .edit-option { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 16px; color: #334155; }
        .edit-option input[type="radio"] { accent-color: #3b82f6; }

        .button { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 15px; font-family: inherit; transition: background-color 0.2s ease, transform 0.1s ease; }
        .button:active { transform: scale(0.98); }
        .btn-cancel { background-color: transparent; color: #64748b; border: 1px solid #e2e8f0; }
        .btn-cancel:hover { background-color: #f1f5f9; }
        .btn-save { background-color: #3b82f6; color: white; }
        .btn-save:hover { background-color: #2563eb; }
      `}</style>

      <Modal
        isOpen={isOpen}
        onRequestClose={handleCancel}
        className="modal-container"
        overlayClassName="modal-overlay"
        appElement={document.getElementById('root')}
      >
        <div className="modal-header">
          <h2 className="modal-title">Edit Recurring Event</h2>
          <button className="close-button" onClick={handleCancel}>
            <CloseIcon size={20} color="#64748b" />
          </button>
        </div>

        <div className="modal-body">
          <p>How would you like to apply this change?</p>
          <div className="edit-options">
            <label className="edit-option">
              <input type="radio" name="editType" value="single" checked={editType==='single'} onChange={()=>setEditType('single')} />
              <span>This event only</span>
            </label>
            <label className="edit-option">
              <input type="radio" name="editType" value="future" checked={editType==='future'} onChange={()=>setEditType('future')} />
              <span>This and all future events</span>
            </label>
            <label className="edit-option">
              <input type="radio" name="editType" value="all" checked={editType==='all'} onChange={()=>setEditType('all')} />
              <span>All events in the series</span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          <button className="btn-save" onClick={handleConfirm}>Confirm</button>
        </div>
      </Modal>
    </>
  );
};

export default EditSeriesModal;
