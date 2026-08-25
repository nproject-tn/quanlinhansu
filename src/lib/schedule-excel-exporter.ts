import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { formatDateVN } from "@/lib/utils";

type Slot = {
  storeId: string;
  shiftTemplateId: string;
  date: string;
  slotIndex: number;
  requiredStaff: number;
  employeeId: string | null;
  faults?: Array<{ id: string; faultType: string; penaltyMinutes?: number; note?: string }>;
};

type Shift = {
  id: string;
  storeId: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
};

type Store = {
  id: string;
  name: string;
  address?: string | null;
};

type Employee = {
  id: string;
  name: string;
  position?: string | null;
  phone?: string | null;
  employmentType?: string | null;
};

type Overtime = {
  id: string;
  storeId: string;
  shiftTemplateId: string;
  date: string;
  employeeId: string;
  hours: number;
};

type DayNote = {
  date: string;
  note: string;
  colorKey?: string;
};

export type ExportScheduleData = {
  companyName?: string;
  mode: "day" | "week" | "month";
  referenceDate: string;
  startDateStr: string;
  endDateStr: string;
  dates: string[];
  stores: Store[];
  shifts: Shift[];
  slots: Slot[];
  employees: Employee[];
  overtimes: Overtime[];
  dayNotes?: DayNote[];
  storeFilterName?: string;
  employeeFilterName?: string;
  selectedEmployeeId?: string;
  selectedEmployeeIds?: string[];
  selectedStoreIds?: string[];
};

export async function exportScheduleToExcel(data: ExportScheduleData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ApexFlow HR";
  workbook.lastModifiedBy = "ApexFlow Auto-Scheduler";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Compute dates fallback if empty
  let dates = data.dates && data.dates.length > 0 ? data.dates : [];
  if (dates.length === 0 && data.slots && data.slots.length > 0) {
    dates = [...new Set(data.slots.map((s) => s.date))].sort();
  }
  if (dates.length === 0 && data.startDateStr && data.endDateStr) {
    try {
      const start = parseISO(data.startDateStr);
      const end = parseISO(data.endDateStr);
      let cur = start;
      while (cur <= end) {
        dates.push(format(cur, "yyyy-MM-dd"));
        cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      }
    } catch (_) {}
  }

  // Filter slots by selected employee(s) if provided
  let filteredSlots = data.slots;
  const targetEmpIds =
    data.selectedEmployeeIds && data.selectedEmployeeIds.length > 0
      ? data.selectedEmployeeIds
      : data.selectedEmployeeId
      ? [data.selectedEmployeeId]
      : [];

  if (targetEmpIds.length > 0) {
    filteredSlots = data.slots.filter((s) => s.employeeId && targetEmpIds.includes(s.employeeId));
  }

  // Filter stores if selectedStoreIds provided
  let filteredStores = data.stores;
  if (data.selectedStoreIds && data.selectedStoreIds.length > 0) {
    filteredStores = data.stores.filter((st) => data.selectedStoreIds!.includes(st.id));
  }

  const employeeMap = new Map<string, Employee>();
  data.employees.forEach((emp) => employeeMap.set(emp.id, emp));

  const storeMap = new Map<string, Store>();
  data.stores.forEach((st) => storeMap.set(st.id, st));

  const shiftMap = new Map<string, Shift>();
  data.shifts.forEach((sh) => shiftMap.set(sh.id, sh));

  const dayNoteMap = new Map<string, string>();
  data.dayNotes?.forEach((dn) => {
    if (dn.note) dayNoteMap.set(dn.date, dn.note);
  });

  // ==========================================
  // SHEET 1: MA TRẬN LỊCH XẾP CA (SCHEDULE MATRIX)
  // ==========================================
  const wsMatrix = workbook.addWorksheet("Lịch xếp ca", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // 1. Title Banner
  wsMatrix.mergeCells("A1", `${getColumnLetter(3 + dates.length)}1`);
  const titleCell = wsMatrix.getCell("A1");
  titleCell.value = `BẢNG LỊCH XẾP CA LÀM VIỆC - ${data.companyName?.toUpperCase() || "APEXFLOW"}`;
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(1).height = 40;

  // 2. Filter & Date Range Subtitle
  wsMatrix.mergeCells("A2", `${getColumnLetter(3 + dates.length)}2`);
  const subtitleCell = wsMatrix.getCell("A2");
  subtitleCell.value = `Kỳ xếp ca: ${formatDateVN(data.startDateStr)} → ${formatDateVN(data.endDateStr)} (${data.mode === "day" ? "Theo ngày" : data.mode === "month" ? "Theo tháng" : "Theo tuần"}) | Cửa hàng: ${data.storeFilterName || "Tất cả cửa hàng"} | Nhân viên: ${data.employeeFilterName || "Tất cả nhân viên"}`;
  subtitleCell.font = { name: "Arial", size: 11, italic: true, bold: true, color: { argb: "FF334155" } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(2).height = 24;

  // 3. Export Meta Info
  wsMatrix.mergeCells("A3", `${getColumnLetter(3 + dates.length)}3`);
  const metaCell = wsMatrix.getCell("A3");
  const assignedCount = filteredSlots.filter((s) => Boolean(s.employeeId)).length;
  const emptyCount = filteredSlots.length - assignedCount;
  metaCell.value = `Thời gian xuất: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")} | Tổng số ca: ${filteredSlots.length} ca (${assignedCount} đã xếp · ${emptyCount} ca trống) | Hệ thống quản trị nhân sự ApexFlow`;
  metaCell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF64748B" } };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(3).height = 20;

  // Blank row
  wsMatrix.getRow(4).height = 8;

  // 4. Header Row 5 (Columns)
  const headerRow = wsMatrix.getRow(5);
  headerRow.height = 36;

  const colA = wsMatrix.getCell("A5");
  colA.value = "CỬA HÀNG";
  styleHeaderCell(colA, "FF334155");

  const colB = wsMatrix.getCell("B5");
  colB.value = "CA LÀM";
  styleHeaderCell(colB, "FF334155");

  const colC = wsMatrix.getCell("C5");
  colC.value = "GIỜ LÀM";
  styleHeaderCell(colC, "FF334155");

  // Date Columns (D5, E5, ...)
  dates.forEach((dateStr, idx) => {
    const colIndex = 4 + idx;
    const cell = headerRow.getCell(colIndex);
    const dateObj = parseISO(dateStr);
    const dayOfWeek = format(dateObj, "EEEE", { locale: vi });
    const formattedDate = format(dateObj, "dd/MM");
    const dayNote = dayNoteMap.get(dateStr);

    cell.value = dayNote
      ? `${dayOfWeek.toUpperCase()}\n${formattedDate}\n[${dayNote}]`
      : `${dayOfWeek.toUpperCase()}\n${formattedDate}`;
    styleHeaderCell(cell, "FF4338CA");
  });

  // 5. Populate Schedule Rows by Store & Shifts
  let currentRowIndex = 6;

  filteredStores.forEach((store) => {
    const storeShifts = data.shifts.filter((s) => s.storeId === store.id);
    if (storeShifts.length === 0) return;

    // Store Section Header Banner
    wsMatrix.mergeCells(`A${currentRowIndex}`, `${getColumnLetter(3 + dates.length)}${currentRowIndex}`);
    const storeBanner = wsMatrix.getCell(`A${currentRowIndex}`);
    storeBanner.value = `📍 ${store.name.toUpperCase()} ${store.address ? `(${store.address})` : ""}`;
    storeBanner.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1E3A8A" } };
    storeBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    storeBanner.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    wsMatrix.getRow(currentRowIndex).height = 26;
    currentRowIndex++;

    // For each Shift in store
    storeShifts.forEach((shift, shiftIdx) => {
      const shiftRow = wsMatrix.getRow(currentRowIndex);
      shiftRow.height = 32;

      // Col A: Store Name
      const cellStore = shiftRow.getCell(1);
      cellStore.value = store.name;
      styleDataCell(cellStore, { bold: true, color: "FF475569", bgColor: shiftIdx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" });

      // Col B: Shift Name
      const cellShift = shiftRow.getCell(2);
      cellShift.value = shift.name;
      styleDataCell(cellShift, { bold: true, color: "FF1E293B", bgColor: shiftIdx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" });

      // Col C: Shift Time
      const cellTime = shiftRow.getCell(3);
      cellTime.value = `${shift.startTime} - ${shift.endTime}\n(${shift.durationHours}h)`;
      styleDataCell(cellTime, { color: "FF64748B", bgColor: shiftIdx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" });

      // Date cells
      dates.forEach((dateStr, dIdx) => {
        const colIndex = 4 + dIdx;
        const cell = shiftRow.getCell(colIndex);

        // Find slots for this date, store, shift
        const matchingSlots = filteredSlots.filter(
          (s) => s.storeId === store.id && s.shiftTemplateId === shift.id && s.date.startsWith(dateStr)
        );

        // Find overtimes
        const matchingOvertimes = data.overtimes.filter(
          (ot) => ot.storeId === store.id && ot.shiftTemplateId === shift.id && ot.date.startsWith(dateStr)
        );

        if (matchingSlots.length > 0) {
          const lines: string[] = [];

          matchingSlots.forEach((slot) => {
            if (slot.employeeId) {
              const emp = employeeMap.get(slot.employeeId);
              let empText = emp?.name || "Nhân viên";

              // Check if employee has overtime in this shift
              const ot = matchingOvertimes.find((o) => o.employeeId === slot.employeeId);
              if (ot) {
                empText += ` (+${ot.hours}h OT)`;
              }

              // Check faults
              if (slot.faults && slot.faults.length > 0) {
                empText += ` [${slot.faults.length} lỗi]`;
              }

              lines.push(empText);
            } else {
              lines.push("— Trống —");
            }
          });

          cell.value = lines.join("\n");

          const hasAssigned = matchingSlots.some((s) => Boolean(s.employeeId));
          const hasEmpty = matchingSlots.some((s) => !s.employeeId);

          if (hasAssigned && !hasEmpty) {
            // All assigned: Soft Blue
            styleDataCell(cell, {
              bold: true,
              color: "FF1E3A8A",
              bgColor: "FFEFF6FF",
              borderColor: "FFBFDBFE",
            });
          } else if (hasAssigned && hasEmpty) {
            // Partially assigned: Soft Purple / Amber
            styleDataCell(cell, {
              bold: true,
              color: "FF854D0E",
              bgColor: "FFFEF9C3",
              borderColor: "FFFDE047",
            });
          } else {
            // All empty: Soft Amber
            styleDataCell(cell, {
              italic: true,
              color: "FFB45309",
              bgColor: "FFFEF3C7",
              borderColor: "FFFDE68A",
            });
          }
        } else {
          cell.value = "—";
          styleDataCell(cell, { color: "FFCBD5E1", bgColor: "FFFFFFFF" });
        }
      });

      currentRowIndex++;
    });
  });

  // Set column widths for Sheet 1
  wsMatrix.getColumn(1).width = 20; // Store
  wsMatrix.getColumn(2).width = 16; // Shift Name
  wsMatrix.getColumn(3).width = 16; // Shift Time
  dates.forEach((_, idx) => {
    wsMatrix.getColumn(4 + idx).width = 22; // Date columns
  });

  // ==========================================
  // SHEET 2: TỔNG HỢP CÔNG & GIỜ LÀM (EMPLOYEE SUMMARY)
  // ==========================================
  const wsSummary = workbook.addWorksheet("Tổng hợp công & Giờ làm", {
    pageSetup: { orientation: "portrait", fitToPage: true },
  });

  const numStores = filteredStores.length;
  // Columns: STT, Name, Position, Phone (4) + Stores (2 columns per store: Shifts & Hours) + Grand Totals (4)
  const totalSummaryCols = 4 + numStores * 2 + 4;
  const endColLetter = getColumnLetter(totalSummaryCols);

  // Title
  wsSummary.mergeCells("A1", `${endColLetter}1`);
  const sumTitle = wsSummary.getCell("A1");
  sumTitle.value = `BẢNG TỔNG HỢP CÔNG & GIỜ LÀM VIỆC - ${data.companyName?.toUpperCase() || "APEXFLOW"}`;
  sumTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  sumTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; // Teal
  sumTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(1).height = 36;

  // Subtitle
  wsSummary.mergeCells("A2", `${endColLetter}2`);
  const sumSubtitle = wsSummary.getCell("A2");
  sumSubtitle.value = `Kỳ thống kê: ${formatDateVN(data.startDateStr)} → ${formatDateVN(data.endDateStr)} | Ngày xuất: ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
  sumSubtitle.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF134E4A" } };
  sumSubtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
  sumSubtitle.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(2).height = 22;

  // Header Row 4
  const sumHeader = wsSummary.getRow(4);
  sumHeader.height = 28;

  const sumHeaders: Array<{ text: string; width: number; col: number }> = [
    { text: "STT", width: 8, col: 1 },
    { text: "HỌ VÀ TÊN NHÂN VIÊN", width: 26, col: 2 },
    { text: "CHỨC VỤ", width: 20, col: 3 },
    { text: "SỐ ĐIỆN THOẠI", width: 16, col: 4 },
  ];

  filteredStores.forEach((st, sIdx) => {
    const shiftCol = 5 + sIdx * 2;
    const hoursCol = 5 + sIdx * 2 + 1;
    sumHeaders.push(
      {
        text: `CA: ${st.name.toUpperCase()}`,
        width: Math.max(15, Math.min(26, st.name.length + 5)),
        col: shiftCol,
      },
      {
        text: `GIỜ: ${st.name.toUpperCase()}`,
        width: Math.max(15, Math.min(26, st.name.length + 6)),
        col: hoursCol,
      }
    );
  });

  const baseAfterStores = 5 + numStores * 2;
  sumHeaders.push(
    { text: "TỔNG SỐ CA", width: 14, col: baseAfterStores },
    { text: "GIỜ TIÊU CHUẨN", width: 18, col: baseAfterStores + 1 },
    { text: "GIỜ TĂNG CA (OT)", width: 18, col: baseAfterStores + 2 },
    { text: "TỔNG GIỜ LÀM", width: 18, col: baseAfterStores + 3 }
  );

  sumHeaders.forEach((h) => {
    const cell = sumHeader.getCell(h.col);
    cell.value = h.text;
    styleHeaderCell(cell, "FF0F766E");
    wsSummary.getColumn(h.col).width = h.width;
  });

  // Calculate stats for each employee
  let sumRowIdx = 5;
  let totalAllShifts = 0;
  let totalAllStandardHours = 0;
  let totalAllOvertimeHours = 0;
  const storeTotalShiftsMap = new Map<string, number>();
  const storeTotalHoursMap = new Map<string, number>();
  filteredStores.forEach((st) => {
    storeTotalShiftsMap.set(st.id, 0);
    storeTotalHoursMap.set(st.id, 0);
  });

  const targetEmps =
    targetEmpIds.length > 0 ? data.employees.filter((e) => targetEmpIds.includes(e.id)) : data.employees;

  targetEmps.forEach((emp, eIdx) => {
    // Assigned slots for this employee in the period (respecting store filter if any)
    const empSlots = data.slots.filter(
      (s) => s.employeeId === emp.id && (data.selectedStoreIds?.length ? data.selectedStoreIds.includes(s.storeId) : true)
    );
    const shiftCount = empSlots.length;

    let standardHours = 0;
    empSlots.forEach((s) => {
      const shift = shiftMap.get(s.shiftTemplateId);
      if (shift) {
        standardHours += shift.durationHours;
      }
    });

    // Overtime hours (respecting store filter if any)
    const empOvertimes = data.overtimes.filter(
      (ot) => ot.employeeId === emp.id && (data.selectedStoreIds?.length ? data.selectedStoreIds.includes(ot.storeId) : true)
    );
    const overtimeHours = empOvertimes.reduce((acc, curr) => acc + curr.hours, 0);
    const totalHours = Math.round((standardHours + overtimeHours) * 10) / 10;

    totalAllShifts += shiftCount;
    totalAllStandardHours += standardHours;
    totalAllOvertimeHours += overtimeHours;

    const row = wsSummary.getRow(sumRowIdx);
    row.height = 22;
    const isEven = eIdx % 2 === 0;
    const rowBg = isEven ? "FFF0FDFA" : "FFFFFFFF";

    // STT
    const c1 = row.getCell(1);
    c1.value = eIdx + 1;
    styleDataCell(c1, { color: "FF475569", bgColor: rowBg, align: "center" });

    // Name
    const c2 = row.getCell(2);
    c2.value = emp.name;
    styleDataCell(c2, { bold: true, color: "FF0F172A", bgColor: rowBg, align: "left" });

    // Position
    const c3 = row.getCell(3);
    c3.value = emp.position || "Nhân viên";
    styleDataCell(c3, { color: "FF475569", bgColor: rowBg, align: "left" });

    // Phone
    const c4 = row.getCell(4);
    c4.value = emp.phone || "—";
    styleDataCell(c4, { color: "FF64748B", bgColor: rowBg, align: "center" });

    // Per-store shift counts & working hours
    filteredStores.forEach((st, sIdx) => {
      const storeSlots = empSlots.filter((s) => s.storeId === st.id);
      const count = storeSlots.length;

      let storeStdHours = 0;
      storeSlots.forEach((s) => {
        const shift = shiftMap.get(s.shiftTemplateId);
        if (shift) storeStdHours += shift.durationHours;
      });

      const storeOts = empOvertimes.filter((ot) => ot.storeId === st.id);
      const storeOtHours = storeOts.reduce((sum, ot) => sum + ot.hours, 0);
      const storeTotalHours = Math.round((storeStdHours + storeOtHours) * 10) / 10;

      storeTotalShiftsMap.set(st.id, (storeTotalShiftsMap.get(st.id) || 0) + count);
      storeTotalHoursMap.set(st.id, (storeTotalHoursMap.get(st.id) || 0) + storeTotalHours);

      const shiftCol = 5 + sIdx * 2;
      const hoursCol = 5 + sIdx * 2 + 1;

      // Shifts at this store
      const cStoreShifts = row.getCell(shiftCol);
      cStoreShifts.value = count;
      styleDataCell(cStoreShifts, {
        bold: count > 0,
        color: count > 0 ? "FF0F766E" : "FF94A3B8",
        bgColor: rowBg,
        align: "center",
      });

      // Hours at this store
      const cStoreHours = row.getCell(hoursCol);
      cStoreHours.value = storeTotalHours;
      styleDataCell(cStoreHours, {
        bold: storeTotalHours > 0,
        color: storeTotalHours > 0 ? "FF1E3A8A" : "FF94A3B8",
        bgColor: rowBg,
        align: "right",
      });
    });

    // Total Shifts
    const cTotalShifts = row.getCell(baseAfterStores);
    cTotalShifts.value = shiftCount;
    styleDataCell(cTotalShifts, { bold: true, color: "FF0F766E", bgColor: rowBg, align: "center" });

    // Standard Hours
    const cStdHours = row.getCell(baseAfterStores + 1);
    cStdHours.value = Math.round(standardHours * 10) / 10;
    styleDataCell(cStdHours, { color: "FF0F172A", bgColor: rowBg, align: "right" });

    // Overtime Hours
    const cOtHours = row.getCell(baseAfterStores + 2);
    cOtHours.value = Math.round(overtimeHours * 10) / 10;
    styleDataCell(cOtHours, {
      bold: overtimeHours > 0,
      color: overtimeHours > 0 ? "FFD97706" : "FF94A3B8",
      bgColor: rowBg,
      align: "right",
    });

    // Total Hours
    const cTotalHours = row.getCell(baseAfterStores + 3);
    cTotalHours.value = totalHours;
    styleDataCell(cTotalHours, { bold: true, color: "FF1E3A8A", bgColor: rowBg, align: "right" });

    sumRowIdx++;
  });

  // Total Summary Footer Row
  const totalRow = wsSummary.getRow(sumRowIdx);
  totalRow.height = 26;
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "TỔNG CỘNG";
  totalRow.getCell(3).value = "";
  totalRow.getCell(4).value = "";

  filteredStores.forEach((st, sIdx) => {
    const shiftCol = 5 + sIdx * 2;
    const hoursCol = 5 + sIdx * 2 + 1;
    totalRow.getCell(shiftCol).value = storeTotalShiftsMap.get(st.id) || 0;
    totalRow.getCell(hoursCol).value = Math.round((storeTotalHoursMap.get(st.id) || 0) * 10) / 10;
  });

  totalRow.getCell(baseAfterStores).value = totalAllShifts;
  totalRow.getCell(baseAfterStores + 1).value = Math.round(totalAllStandardHours * 10) / 10;
  totalRow.getCell(baseAfterStores + 2).value = Math.round(totalAllOvertimeHours * 10) / 10;
  totalRow.getCell(baseAfterStores + 3).value = Math.round((totalAllStandardHours + totalAllOvertimeHours) * 10) / 10;

  for (let c = 1; c <= totalSummaryCols; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F766E" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFBF1" } };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F766E" } },
      bottom: { style: "double", color: { argb: "FF0F766E" } },
      left: { style: "thin", color: { argb: "FF99F6E4" } },
      right: { style: "thin", color: { argb: "FF99F6E4" } },
    };
    if (c === 1 || c === baseAfterStores) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    } else if (c >= 5 && c < baseAfterStores) {
      const storeOffset = c - 5;
      const isShiftCol = storeOffset % 2 === 0;
      cell.alignment = { horizontal: isShiftCol ? "center" : "right", vertical: "middle" };
    } else if (c > baseAfterStores) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    }
  }

  // ==========================================
  // SHEET 3: CHI TIẾT TĂNG CA & VI PHẠM (DETAILS)
  // ==========================================
  const wsDetails = workbook.addWorksheet("Chi tiết Tăng ca & Vi phạm", {
    pageSetup: { orientation: "portrait", fitToPage: true },
  });

  // Title
  wsDetails.mergeCells("A1", "G1");
  const detTitle = wsDetails.getCell("A1");
  detTitle.value = `CHI TIẾT TĂNG CA & VI PHẠM TRONG KỲ - ${data.companyName?.toUpperCase() || "APEXFLOW"}`;
  detTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  detTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } }; // Deep Red
  detTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsDetails.getRow(1).height = 36;

  // Header Row 3
  const detHeader = wsDetails.getRow(3);
  detHeader.height = 28;

  const detHeaders = [
    { text: "STT", width: 8, col: 1 },
    { text: "NGÀY", width: 14, col: 2 },
    { text: "CỬA HÀNG", width: 22, col: 3 },
    { text: "CA LÀM", width: 16, col: 4 },
    { text: "NHÂN VIÊN", width: 24, col: 5 },
    { text: "LOẠI GHI NHẬN", width: 18, col: 6 },
    { text: "CHI TIẾT / GHI CHÚ", width: 32, col: 7 },
  ];

  detHeaders.forEach((h) => {
    const cell = detHeader.getCell(h.col);
    cell.value = h.text;
    styleHeaderCell(cell, "FF991B1B");
    wsDetails.getColumn(h.col).width = h.width;
  });

  let detRowIdx = 4;
  let detCounter = 1;

  // 1. List all Overtimes
  data.overtimes.forEach((ot) => {
    const store = storeMap.get(ot.storeId);
    const shift = shiftMap.get(ot.shiftTemplateId);
    const emp = employeeMap.get(ot.employeeId);

    const row = wsDetails.getRow(detRowIdx);
    row.height = 22;

    const c1 = row.getCell(1);
    c1.value = detCounter++;
    styleDataCell(c1, { align: "center", bgColor: "FFF0FDF4" });

    const c2 = row.getCell(2);
    c2.value = format(parseISO(ot.date), "dd/MM/yyyy");
    styleDataCell(c2, { align: "center", bgColor: "FFF0FDF4" });

    const c3 = row.getCell(3);
    c3.value = store?.name || "—";
    styleDataCell(c3, { align: "left", bgColor: "FFF0FDF4" });

    const c4 = row.getCell(4);
    c4.value = shift?.name || "—";
    styleDataCell(c4, { align: "left", bgColor: "FFF0FDF4" });

    const c5 = row.getCell(5);
    c5.value = emp?.name || "—";
    styleDataCell(c5, { bold: true, align: "left", bgColor: "FFF0FDF4" });

    const c6 = row.getCell(6);
    c6.value = "TĂNG CA (OT)";
    styleDataCell(c6, { bold: true, color: "FF16A34A", align: "center", bgColor: "FFDCFCE7" });

    const c7 = row.getCell(7);
    c7.value = `Làm thêm ${ot.hours} tiếng`;
    styleDataCell(c7, { color: "FF15803D", align: "left", bgColor: "FFF0FDF4" });

    detRowIdx++;
  });

  // 2. List all Faults
  data.slots.forEach((slot) => {
    if (!slot.faults || slot.faults.length === 0) return;
    const store = storeMap.get(slot.storeId);
    const shift = shiftMap.get(slot.shiftTemplateId);
    const emp = slot.employeeId ? employeeMap.get(slot.employeeId) : null;

    slot.faults.forEach((fault) => {
      const row = wsDetails.getRow(detRowIdx);
      row.height = 22;

      const c1 = row.getCell(1);
      c1.value = detCounter++;
      styleDataCell(c1, { align: "center", bgColor: "FFFFF1F2" });

      const c2 = row.getCell(2);
      c2.value = format(parseISO(slot.date), "dd/MM/yyyy");
      styleDataCell(c2, { align: "center", bgColor: "FFFFF1F2" });

      const c3 = row.getCell(3);
      c3.value = store?.name || "—";
      styleDataCell(c3, { align: "left", bgColor: "FFFFF1F2" });

      const c4 = row.getCell(4);
      c4.value = shift?.name || "—";
      styleDataCell(c4, { align: "left", bgColor: "FFFFF1F2" });

      const c5 = row.getCell(5);
      c5.value = emp?.name || "Chưa phân công";
      styleDataCell(c5, { bold: true, align: "left", bgColor: "FFFFF1F2" });

      const c6 = row.getCell(6);
      c6.value = "VI PHẠM";
      styleDataCell(c6, { bold: true, color: "FFDC2626", align: "center", bgColor: "FFFEE2E2" });

      const c7 = row.getCell(7);
      c7.value = `${fault.faultType} ${fault.penaltyMinutes ? `(Trễ ${fault.penaltyMinutes}p)` : ""} ${fault.note ? `- ${fault.note}` : ""}`;
      styleDataCell(c7, { color: "FFB91C1C", align: "left", bgColor: "FFFFF1F2" });

      detRowIdx++;
    });
  });

  if (detCounter === 1) {
    const row = wsDetails.getRow(detRowIdx);
    wsDetails.mergeCells(`A${detRowIdx}`, `G${detRowIdx}`);
    const emptyCell = wsDetails.getCell(`A${detRowIdx}`);
    emptyCell.value = "Không có ghi nhận tăng ca hoặc vi phạm nào trong kỳ.";
    emptyCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF94A3B8" } };
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    row.height = 30;
  }

  // ==========================================
  // GENERATE BLOB & TRIGGER DOWNLOAD
  // ==========================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileName = `lich_xep_ca_${data.startDateStr}_${data.endDateStr}.xlsx`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// Helper Functions for Styling Cells & Borders
// ----------------------------------------------------
function styleHeaderCell(cell: ExcelJS.Cell, bgColorHex: string) {
  cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColorHex } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "FF94A3B8" } },
    bottom: { style: "medium", color: { argb: "FF1E293B" } },
    left: { style: "thin", color: { argb: "FF94A3B8" } },
    right: { style: "thin", color: { argb: "FF94A3B8" } },
  };
}

function styleDataCell(
  cell: ExcelJS.Cell,
  options?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    bgColor?: string;
    borderColor?: string;
    align?: "left" | "center" | "right";
  }
) {
  cell.font = {
    name: "Arial",
    size: 9.5,
    bold: options?.bold ?? false,
    italic: options?.italic ?? false,
    color: { argb: options?.color ?? "FF1E293B" },
  };
  if (options?.bgColor) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.bgColor } };
  }
  cell.alignment = {
    horizontal: options?.align ?? "center",
    vertical: "middle",
    wrapText: true,
  };
  const bColor = options?.borderColor ?? "FFE2E8F0";
  cell.border = {
    top: { style: "thin", color: { argb: bColor } },
    bottom: { style: "thin", color: { argb: bColor } },
    left: { style: "thin", color: { argb: bColor } },
    right: { style: "thin", color: { argb: bColor } },
  };
}

function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}
