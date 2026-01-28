export const COMMON_CSS = `
.zero-inline-icon {
  height: 14px;
  width: 14px;
  vertical-align: -2px;
  margin: 0 1px;
  display: inline-block;
}

/* Global Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

@keyframes streakPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes fadeIn {
  to { opacity: 1; }
}

@keyframes scaleIn {
  to { transform: scale(1); }
}

@keyframes professorFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes professorSlideIn {
  from { transform: translateY(30px) scale(0.9); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* Premium Scrollbars */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #0d1117;
}

::-webkit-scrollbar-thumb {
  background: rgba(20, 184, 166, 0.2);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: #14b8a6;
  background-clip: content-box;
}
`;
