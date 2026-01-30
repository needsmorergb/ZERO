export const MODALS_CSS = `
/* Confirm Modal */
.confirm-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
}

.confirm-modal {
  background: linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(10,15,30,0.99) 100%);
  border: 1px solid rgba(99,102,241,0.35);
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  font-family: 'Inter', sans-serif;
}

.confirm-modal h3 {
  margin: 0 0 12px 0;
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 700;
}

.confirm-modal p {
  margin: 0 0 20px 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
}

.confirm-modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.confirm-modal-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.confirm-modal-btn.cancel {
  background: rgba(100,116,139,0.3);
  color: #94a3b8;
}

.confirm-modal-btn.cancel:hover {
  background: rgba(100,116,139,0.5);
}

.confirm-modal-btn.confirm {
  background: rgba(239,68,68,0.8);
  color: white;
}

.confirm-modal-btn.confirm:hover {
  background: rgba(239,68,68,1);
}

/* Emotion Selector Modal */
.emotion-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
  opacity: 0;
  animation: fadeIn 0.2s forwards;
}

.emotion-modal {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 16px;
  padding: 24px;
  width: 340px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  text-align: center;
  transform: scale(0.9);
  animation: scaleIn 0.2s forwards;
}

.emotion-title {
  color: #14b8a6;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.emotion-subtitle {
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 20px;
}

.emotion-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.emotion-btn {
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.15);
  color: #bdc6d5;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.emotion-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.emotion-btn:hover {
  background: rgba(20,184,166,0.05);
  border-color: rgba(20,184,166,0.3);
  color: #f8fafc;
  transform: translateY(-2px);
}

.emotion-btn.selected {
  background: rgba(20,184,166,0.15);
  border-color: #14b8a6;
  color: #14b8a6;
}

.emotion-skip {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.emotion-skip:hover {
  color: #94a3b8;
}

/* Settings Modal */
.settings-modal {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 16px;
  padding: 24px;
  width: 320px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8);
  font-family: 'Inter', sans-serif;
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  padding-bottom: 12px;
}

.settings-title {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-close {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 18px;
  transition: color 0.2s;
}

.settings-close:hover {
  color: #f8fafc;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.setting-info {
  flex: 1;
}

.setting-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.setting-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.3;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #1e293b;
  transition: .3s;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.1);
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #14b8a6;
  border-color: #14b8a6;
}

input:checked + .slider:before {
  transform: translateX(18px);
}

/* Paywall Modal */
.paywall-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
  animation: fadeIn 0.2s ease;
}

.paywall-modal {
  background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 20px;
  padding: 0;
  width: 460px;
  max-width: 90vw;
  box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1);
  font-family: 'Inter', sans-serif;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.paywall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%);
  border-bottom: 1px solid rgba(99,102,241,0.15);
}

.paywall-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.3);
}

.badge-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.paywall-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
  padding: 4px 8px;
  line-height: 1;
}

.paywall-close:hover {
  color: #f8fafc;
}

.paywall-hero {
  padding: 28px 24px 24px;
  text-align: center;
}

.paywall-title {
  font-size: 24px;
  font-weight: 800;
  color: #f8fafc;
  margin: 0 0 8px 0;
  line-height: 1.2;
}

.paywall-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

.paywall-features {
  padding: 0 24px 24px;
  display: grid;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: rgba(15,23,42,0.6);
  border: 1px solid rgba(99,102,241,0.1);
  border-radius: 12px;
  transition: all 0.2s;
}

.feature-item:hover {
  background: rgba(99,102,241,0.05);
  border-color: rgba(99,102,241,0.2);
  transform: translateX(4px);
}

.feature-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.feature-text {
  flex: 1;
}

.feature-name {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.paywall-pricing {
  padding: 20px 24px;
  text-align: center;
  background: rgba(99,102,241,0.05);
  border-top: 1px solid rgba(99,102,241,0.1);
  border-bottom: 1px solid rgba(99,102,241,0.1);
}

.price-tag {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 6px;
}

.price-amount {
  font-size: 36px;
  font-weight: 800;
  color: #6366f1;
  line-height: 1;
}

.price-period {
  font-size: 16px;
  color: #94a3b8;
  font-weight: 600;
}

.price-subtext {
  font-size: 11px;
  color: #64748b;
}

.paywall-actions {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.paywall-btn {
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.paywall-btn.primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
}

.paywall-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99,102,241,0.5);
}

.paywall-btn.secondary {
  background: rgba(99,102,241,0.1);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2);
}

.paywall-btn.secondary:hover {
  background: rgba(99,102,241,0.15);
  border-color: rgba(99,102,241,0.3);
}

.btn-icon {
  font-size: 16px;
}

.paywall-footer {
  padding: 16px 24px 24px;
  text-align: center;
}

.paywall-footer p {
  font-size: 11px;
  color: #64748b;
  margin: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Tier Tag */
.pro-tag {
  display: inline-block;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 8px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  letter-spacing: 0.5px;
  vertical-align: middle;
  box-shadow: 0 2px 6px rgba(99,102,241,0.3);
}
`;
