// مدير الإنذارات + جهات الاتصال الطارئة + سجل الأحداث
// Alert Manager + Emergency Contacts + Event Logger

import { prisma } from '@/lib/prisma';
import type { RiskAssessment, VitalReading, AlertAction } from './types';

// ========================================
// 1. إطلاق/تحديث إنذار
// ========================================
export async function triggerAlert(
  userId: string,
  reading: VitalReading,
  risk: RiskAssessment,
): Promise<string> {
  // إنشاء إنذار جديد
  const alert = await prisma.safetyAlert.create({
    data: {
      userId,
      level: risk.overallRisk,
      title: getAlertTitle(risk.overallRisk),
      message: getAlertMessage(risk),
      heartRate: reading.heartRate ?? null,
      spo2: reading.spo2 ?? null,
      riskScore: risk.riskScore,
    },
  });

  // تسجيل الأحداث في الخط الزمني
  await logTimeline(alert.id, userId, 'alert_triggered', {
    level: risk.overallRisk,
    riskScore: risk.riskScore,
    indicators: risk.activeIndicators,
  });

  // إرسال إشعارات للجهات المختصة
  if (risk.overallRisk === 'critical' || risk.overallRisk === 'warning') {
    const contacts = await prisma.emergencyContact.findMany({
      where: {
        userId,
        isActive: true,
        ...(risk.overallRisk === 'critical'
          ? { notifyOnCritical: true }
          : { notifyOnWarning: true }),
      },
      orderBy: { priority: 'asc' },
    });

    for (const contact of contacts) {
      await logTimeline(alert.id, userId, 'contact_notified', {
        contactId: contact.id,
        contactName: contact.name,
        relationship: contact.relationship,
      });
    }
  }

  return alert.id;
}

// ========================================
// 2. تأكيد استلام الإنذار
// ========================================
export async function acknowledgeAlert(alertId: string, userId: string, acknowledgedBy: string): Promise<void> {
  await prisma.safetyAlert.update({
    where: { id: alertId },
    data: { acknowledged: true, acknowledgedBy, acknowledgedAt: new Date() },
  });
  await logTimeline(alertId, userId, 'alert_acknowledged', { acknowledgedBy });
}

// ========================================
// 3. حل الإنذار
// ========================================
export async function resolveAlert(alertId: string, userId: string): Promise<void> {
  await prisma.safetyAlert.update({
    where: { id: alertId },
    data: { resolvedAt: new Date() },
  });
  await logTimeline(alertId, userId, 'alert_resolved', {});
}

// ========================================
// 4. جلب الإنذارات النشطة
// ========================================
export async function getActiveAlerts(userId: string) {
  return prisma.safetyAlert.findMany({
    where: { userId, acknowledged: false, resolvedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

// ========================================
// 5. جلب جهات الاتصال
// ========================================
export async function getEmergencyContacts(userId: string) {
  return prisma.emergencyContact.findMany({
    where: { userId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });
}

// ========================================
// 6. إضافة جهة اتصال
// ========================================
export async function addEmergencyContact(userId: string, data: {
  name: string;
  phone: string;
  relationship: string;
  priority?: number;
  isPrimary?: boolean;
  notifyOnCritical?: boolean;
  notifyOnWarning?: boolean;
}) {
  // إذا كانت جديدة primary، نلغي الـ primary القديمة
  if (data.isPrimary) {
    await prisma.emergencyContact.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  return prisma.emergencyContact.create({
    data: { userId, ...data },
  });
}

// ========================================
// 7. حذف جهة اتصال
// ========================================
export async function deleteEmergencyContact(userId: string, contactId: string) {
  const contact = await prisma.emergencyContact.findFirst({
    where: { id: contactId, userId },
  });
  if (!contact) throw new Error('غير موجود');
  await prisma.emergencyContact.delete({ where: { id: contactId } });
}

// ========================================
// 8. سجل الأحداث
// ========================================
export async function logTimeline(alertId: string, _userId: string, action: string, detail: Record<string, unknown>) {
  await prisma.emergencyTimeline.create({
    data: {
      alertId,
      action,
      detail: JSON.stringify(detail),
    },
  });
}

export async function getTimeline(alertId: string) {
  return prisma.emergencyTimeline.findMany({
    where: { alertId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getUserTimeline(userId: string, limit = 50) {
  return prisma.emergencyTimeline.findMany({
    where: { alert: { userId } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ========================================
// 9. جلب آخر عيّنة قياس
// ========================================
export async function getLatestVitals(userId: string): Promise<VitalReading | null> {
  const sample = await prisma.vitalSample.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' },
  });
  if (sample) {
    return {
      timestamp: sample.timestamp,
      heartRate: sample.heartRate,
      heartRateVariability: sample.heartRateVariability,
      spo2: sample.spo2,
      respiratoryRate: sample.respiratoryRate,
      bodyTemperature: sample.bodyTemperature,
      stressLevel: sample.stressLevel,
      movementMagnitude: sample.movementMagnitude,
      gpsLat: sample.gpsLat,
      gpsLng: sample.gpsLng,
      batteryLevel: sample.batteryLevel,
      workoutStatus: sample.workoutStatus,
      signalQuality: sample.signalQuality,
      provider: sample.source,
    };
  }
  // Fallback: read from DailyActivity (mobile app sends heart rate here)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activity = await prisma.dailyActivity.findFirst({
    where: { userId, date: { gte: today } },
    orderBy: { date: 'desc' },
  });
  if (!activity) return null;
  return {
    timestamp: activity.updatedAt,
    heartRate: activity.avgHeartRate,
    heartRateVariability: null,
    spo2: activity.avgSpo2,
    respiratoryRate: null,
    bodyTemperature: null,
    stressLevel: null,
    movementMagnitude: null,
    gpsLat: null,
    gpsLng: null,
    batteryLevel: null,
    workoutStatus: null,
    signalQuality: null,
    provider: 'mobile',
  };
}

// ========================================
// 10. دوال مساعدة
// ========================================
function getAlertTitle(level: string): string {
  switch (level) {
    case 'critical': return '🚨 تم اكتشاف حالة طوارئ محتملة — تحقق من السبّاح فورًا';
    case 'warning': return '⚠️ تحذير — تم اكتشاف علامات حيوية غير طبيعية';
    case 'attention': return '📋 انتباه — تم اكتشاف قراءة غير معتادة';
    default: return 'تحديث المراقبة';
  }
}

function getAlertMessage(risk: RiskAssessment): string {
  const parts: string[] = [];
  if (risk.riskScore >= 60) parts.push('تم اكتشاف مؤشرات غير طبيعية متعددة');
  if (risk.isMovementAnomaly) parts.push('تم اكتشاف شذوذ في الحركة');
  if (risk.swimSessionActive) parts.push('أثناء جلسة سباحة نشطة');
  parts.push(`درجة الخطورة: ${risk.riskScore}/100`);
  return parts.join('. ');
}

// بناء بيانات الإجراءات المطلوبة
export function buildAlertActions(level: string, contacts: Array<{ id: string; name: string; phone: string }>): AlertAction[] {
  const actions: AlertAction[] = [];
  if (level === 'critical') {
    actions.push({ type: 'push', target: 'all_contacts', message: '🚨 SWIMMER EMERGENCY — Check immediately', priority: 'critical' });
    actions.push({ type: 'sound', target: 'swimmer_phone', message: 'Emergency Alarm', priority: 'critical' });
    actions.push({ type: 'haptic', target: 'watch', message: 'Strong vibration pattern', priority: 'critical' });
    actions.push({ type: 'dashboard', target: 'safety_dashboard', message: 'CRITICAL SWIMMER ALERT', priority: 'critical' });
    for (const c of contacts) {
      actions.push({ type: 'sms', target: c.phone, message: `Emergency: ${c.name} — possible swimmer emergency`, priority: 'critical' });
    }
  } else if (level === 'warning') {
    actions.push({ type: 'push', target: 'all_contacts', message: '⚠️ Abnormal vital signs detected', priority: 'warning' });
    actions.push({ type: 'haptic', target: 'watch', message: 'Moderate vibration', priority: 'warning' });
    actions.push({ type: 'dashboard', target: 'safety_dashboard', message: 'CHECK SWIMMER', priority: 'warning' });
  } else if (level === 'attention') {
    actions.push({ type: 'dashboard', target: 'safety_dashboard', message: 'Attention — monitor closely', priority: 'attention' });
  }
  return actions;
}
