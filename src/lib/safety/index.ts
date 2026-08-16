// نقطة الدخول الرئيسية لنظام السلامة
// Smart Swimmer Safety & Emergency Alert System — Main Entry

export { assessRisk } from './risk-engine';
export { triggerAlert, acknowledgeAlert, resolveAlert, getActiveAlerts, getEmergencyContacts, addEmergencyContact, deleteEmergencyContact, logTimeline, getTimeline, getUserTimeline, getLatestVitals, buildAlertActions } from './alert-manager';
export { updateBaseline, getBaseline } from './baseline';
export { analyzeMovement } from './movement-analyzer';
export { checkFalseAlarmProtection, isInCooldown } from './false-alarm';
export { DEFAULT_THRESHOLDS } from './types';
export type { RiskLevel, RiskAssessment, VitalReading, VitalAssessment, BaselineData, SafetyThresholds, EmergencyContactData, SafetyDashboardData } from './types';
