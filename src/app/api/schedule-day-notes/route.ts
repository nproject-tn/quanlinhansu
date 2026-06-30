import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { scheduleDayNoteSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const notes = await prisma.scheduleDayNote.findMany({
      where:
        from && to
          ? {
              date: {
                gte: parseDateOnly(from),
                lte: parseDateOnly(to),
              },
            }
          : undefined,
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
    const { error } = await requireAuth(["ADMIN"]);
    if (error) return error;

    const body = await request.json();

    if (Array.isArray(body)) {
      const operations = [];
      for (const item of body) {
        const parsed = scheduleDayNoteSchema.safeParse(item);
        if (!parsed.success) continue;
        operations.push(
          prisma.scheduleDayNote.upsert({
            where: {
              date: parseDateOnly(parsed.data.date),
            },
            create: {
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
        date: parseDateOnly(parsed.data.date),
      },
      create: {
        date: parseDateOnly(parsed.data.date),
        note: parsed.data.note,
        colorKey: parsed.data.colorKey,
      },
      update: {
        note: parsed.data.note,
        colorKey: parsed.data.colorKey,
      },
    });

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
    const { error } = await requireAuth(["ADMIN"]);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Thiếu ngày cần xóa ghi chú" }, { status: 400 });
    }

    await prisma.scheduleDayNote.deleteMany({
      where: { date: parseDateOnly(date) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/schedule-day-notes failed", error);
    return NextResponse.json({ error: "Không xóa được ghi chú ngày" }, { status: 500 });
  }
}
