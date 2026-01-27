/**
 * CSS for the extended Settings Panel (Privacy & Data, Pro/Elite cards).
 */
export const SETTINGS_PANEL_CSS = `
/* Section titles */
.settings-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 20px 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(20,184,166,0.08);
}

/* Tier badges */
.tier-badge {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.tier-badge.pro {
  background: rgba(99,102,241,0.15);
  color: #818cf8;
}

.tier-badge.elite {
  background: rgba(245,158,11,0.15);
  color: #f59e0b;
}

/* Privacy info box */
.privacy-info-box {
  background: rgba(20,184,166,0.03);
  border: 1px solid rgba(20,184,166,0.08);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.privacy-info-box p {
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  margin: 0 0 6px 0;
}

.privacy-info-box p:last-child {
  margin-bottom: 0;
}

/* Diagnostics status */
.diag-status {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.08);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
}

.diag-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.diag-label {
  font-size: 11px;
  color: #64748b;
}

.diag-value {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}

.diag-value.enabled {
  color: #10b981;
}

.diag-value.disabled {
  color: #64748b;
}

.diag-value.error {
  color: #ef4444;
  font-size: 10px;
  max-width: 200px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Settings action buttons */
.settings-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.settings-action-btn {
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(20,184,166,0.15);
  background: rgba(20,184,166,0.05);
  color: #94a3b8;
  transition: all 0.2s;
}

.settings-action-btn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}

.settings-action-btn.danger {
  border-color: rgba(239,68,68,0.15);
  background: rgba(239,68,68,0.05);
}

.settings-action-btn.danger:hover {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}

/* Feature cards */
.feature-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #0d1117;
  border: 1px solid rgba(100,116,139,0.12);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.feature-card:hover {
  background: rgba(20,184,166,0.03);
  border-color: rgba(20,184,166,0.15);
  transform: translateX(2px);
}

.feature-card-lock {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.6;
}

.feature-card-body {
  flex: 1;
  min-width: 0;
}

.feature-card-name {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.feature-card-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.feature-card-badge {
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(100,116,139,0.1);
}
`;
