// GET /api/safety/contacts — جلب جهات الاتصال
// POST /api/safety/contacts — إضافة جهة اتصال
// DELETE /api/safety/contacts — حذف جهة اتصال

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getEmergencyContacts, addEmergencyContact, deleteEmergencyContact } from '@/lib/safety';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const contacts = await getEmergencyContacts(user.id);
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.phone) {
    return NextResponse.json({ error: 'الاسم والهاتف مطلوبان' }, { status: 400 });
  }

  const contact = await addEmergencyContact(user.id, {
    name: body.name,
    phone: body.phone,
    relationship: body.relationship ?? 'other',
    priority: body.priority ?? 1,
    isPrimary: body.isPrimary ?? false,
    notifyOnCritical: body.notifyOnCritical ?? true,
    notifyOnWarning: body.notifyOnWarning ?? false,
  });

  return NextResponse.json({ ok: true, contact });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.contactId) return NextResponse.json({ error: 'المعرّف مطلوب' }, { status: 400 });

  try {
    await deleteEmergencyContact(user.id, body.contactId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  }
}
