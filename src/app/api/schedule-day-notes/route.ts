import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { scheduleDayNoteSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
  try {
    const { error, companyId } = await requireAuth(["OWNER"], [
      { module: "schedule", action: "VIEW" },
      { module: "shift_config", action: "VIEW" }
    ]);
    if (error || !companyId) return error;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const notes = await prisma.scheduleDayNote.findMany({
      where: {
        companyId,
        ...(from && to
          ? {
              date: {
                gte: parseDateOnly(from),
                lte: parseDateOnly(to),
              },
            }
          : {}),
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(
      notes.map((note) => ({
        ...note,
        date: formatDateOnly(note.date),
      }))
    );
  } catch (error) {
    console.error("GET /api/schedule-day-notes failed", error);
    return NextResponse.json({ error: "Không tải được ghi chú ngày" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authCheck = await requireAuth(["OWNER"], [
      { module: "schedule", action: "EDIT" },
      { module: "shift_config", action: "EDIT" }
    ]);
    if (authCheck.error || !authCheck.companyId) return authCheck.error;

    const { companyId, user } = authCheck;
    const body = await request.json();

    if (Array.isArray(body)) {
      const operations = [];
      for (const item of body) {
        const parsed = scheduleDayNoteSchema.safeParse(item);
        if (!parsed.success) continue;
        operations.push(
          prisma.scheduleDayNote.upsert({
            where: {
              companyId_date: {
                companyId,
                date: parseDateOnly(parsed.data.date),
              },
            },
            create: {
              companyId,
              date: parseDateOnly(parsed.data.date),
              note: parsed.data.note,
              colorKey: parsed.data.colorKey,
            },
            update: {
              note: parsed.data.note,
              colorKey: parsed.data.colorKey,
            },
          })
        );
      }

      const results = operations.length > 0 ? await prisma.$transaction(operations) : [];

      if (results.length > 0 && user) {
        await logActivity({
          companyId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "UPDATE",
          module: "schedule",
          targetType: "ScheduleDayNote",
          targetId: "batch",
          targetName: "Ghi chú ngày",
          description: `Đã cập nhật ${results.length} ghi chú ngày`,
          details: { count: results.length },
        });
      }

      return NextResponse.json(
        results.map((note) => ({
          ...note,
          date: formatDateOnly(note.date),
        }))
      );
    }

    const parsed = scheduleDayNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const note = await prisma.scheduleDayNote.upsert({
      where: {
        companyId_date: {
          companyId,
          date: parseDateOnly(parsed.data.date),
        },
      },
      create: {
        companyId,
        date: parseDateOnly(parsed.data.date),
        note: parsed.data.note,
        colorKey: parsed.data.colorKey,
      },
      update: {
        note: parsed.data.note,
        colorKey: parsed.data.colorKey,
      },
    });

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "UPDATE",
        module: "schedule",
        targetType: "ScheduleDayNote",
        targetId: note.id,
        targetName: parsed.data.date,
        description: `Đã lưu ghi chú cho ngày ${parsed.data.date}: "${parsed.data.note}"`,
        details: {
          date: parsed.data.date,
          note: parsed.data.note,
        },
      });
    }

    return NextResponse.json({
      ...note,
      date: formatDateOnly(note.date),
    });
  } catch (error) {
    console.error("POST /api/schedule-day-notes failed", error);
    return NextResponse.json({ error: "Không lưu được ghi chú ngày" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authCheck = await requireAuth(["OWNER"], [
      { module: "schedule", action: "EDIT" },
      { module: "shift_config", action: "EDIT" }
    ]);
    if (authCheck.error || !authCheck.companyId) return authCheck.error;

    const { companyId, user } = authCheck;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Thiếu ngày cần xóa ghi chú" }, { status: 400 });
    }

    await prisma.scheduleDayNote.deleteMany({
      where: { companyId, date: parseDateOnly(date) },
    });

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "DELETE",
        module: "schedule",
        targetType: "ScheduleDayNote",
        targetId: date,
        targetName: date,
        description: `Đã xoá ghi chú của ngày ${date}`,
        details: { date },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/schedule-day-notes failed", error);
    return NextResponse.json({ error: "Không xóa được ghi chú ngày" }, { status: 500 });
  }
}
