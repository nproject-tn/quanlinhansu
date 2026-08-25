import { toPng } from "html-to-image";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { formatDateVN } from "@/lib/utils";
import type { ExportScheduleData } from "./schedule-excel-exporter";

export async function exportScheduleToImage(data: ExportScheduleData) {
  // 1. Resolve dates array safely
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

  // 2. Filter slots by selected employee(s) if provided
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

  const employeeMap = new Map<string, any>();
  data.employees.forEach((emp) => employeeMap.set(emp.id, emp));

  const storeMap = new Map<string, any>();
  data.stores.forEach((st) => storeMap.set(st.id, st));

  const shiftMap = new Map<string, any>();
  data.shifts.forEach((sh) => shiftMap.set(sh.id, sh));

  const dayNoteMap = new Map<string, string>();
  data.dayNotes?.forEach((dn) => {
    if (dn.note) dayNoteMap.set(dn.date, dn.note);
  });

  const assignedCount = filteredSlots.filter((s) => Boolean(s.employeeId)).length;
  const emptyCount = filteredSlots.length - assignedCount;

  // 3. Dynamic layout dimensions based on date count (Pixel-Perfect Math)
  const isMonthView = dates.length > 7;
  const dateColWidth = isMonthView ? 160 : 230; // 230px for week/day view with ample padding
  const fixedColsWidth = 270; // 270px for Store / Shift info
  const tableWidth = fixedColsWidth + dates.length * dateColWidth;
  
  const cardPadding = 32; // 32px left + 32px right = 64px
  const totalCardWidth = tableWidth + cardPadding * 2;
  const rootPadding = 24; // 24px left + 24px right = 48px
  const totalRootWidth = totalCardWidth + rootPadding * 2;

  // 4. Create Off-Screen Canvas Root
  const root = document.createElement("div");
  root.id = "apexflow-export-render-canvas";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "0";
  root.style.zIndex = "-9999";
  root.style.opacity = "0";
  root.style.pointerEvents = "none";
  root.style.boxSizing = "border-box";
  root.style.width = `${totalRootWidth}px`;
  root.style.backgroundColor = "#F8FAFC";
  root.style.padding = `${rootPadding}px`;
  root.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  root.style.color = "#0F172A";

  // Inner Card (Target element to capture)
  const card = document.createElement("div");
  card.style.boxSizing = "border-box";
  card.style.backgroundColor = "#FFFFFF";
  card.style.borderRadius = "20px";
  card.style.border = "1px solid #E2E8F0";
  card.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.05)";
  card.style.padding = `${cardPadding}px`;
  card.style.width = `${totalCardWidth}px`;
  card.style.overflow = "visible";

  // 5. Header Banner
  const header = document.createElement("div");
  header.style.boxSizing = "border-box";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "flex-start";
  header.style.borderBottom = "2px solid #E2E8F0";
  header.style.paddingBottom = "20px";
  header.style.marginBottom = "24px";
  header.style.width = "100%";

  // Header Left
  const headerLeft = document.createElement("div");

  const brandRow = document.createElement("div");
  brandRow.style.display = "flex";
  brandRow.style.alignItems = "center";
  brandRow.style.gap = "8px";
  brandRow.style.marginBottom = "6px";

  const brandPill = document.createElement("span");
  brandPill.innerText = "APEXFLOW HR";
  brandPill.style.fontSize = "11px";
  brandPill.style.fontWeight = "800";
  brandPill.style.letterSpacing = "0.08em";
  brandPill.style.color = "#FFFFFF";
  brandPill.style.backgroundColor = "#0F172A";
  brandPill.style.padding = "3px 8px";
  brandPill.style.borderRadius = "6px";
  brandRow.appendChild(brandPill);

  const brandSubtitle = document.createElement("span");
  brandSubtitle.innerText = `${data.companyName?.toUpperCase() || "DOANH NGHIỆP"} • HỆ THỐNG XẾP CA THÔNG MINH`;
  brandSubtitle.style.fontSize = "12px";
  brandSubtitle.style.fontWeight = "600";
  brandSubtitle.style.color = "#64748B";
  brandRow.appendChild(brandSubtitle);
  headerLeft.appendChild(brandRow);

  const title = document.createElement("h1");
  title.innerText = "BẢNG LỊCH XẾP CA LÀM VIỆC DẠNG BẢNG NGANG";
  title.style.fontSize = "24px";
  title.style.fontWeight = "800";
  title.style.color = "#0F172A";
  title.style.margin = "0 0 8px 0";
  title.style.letterSpacing = "-0.02em";
  headerLeft.appendChild(title);

  const metaRow = document.createElement("div");
  metaRow.style.display = "flex";
  metaRow.style.flexWrap = "wrap";
  metaRow.style.gap = "16px";
  metaRow.style.fontSize = "13px";
  metaRow.style.fontWeight = "500";
  metaRow.style.color = "#475569";

  metaRow.innerHTML = `
    <span>📅 <strong>Kỳ xếp ca:</strong> ${formatDateVN(data.startDateStr)} → ${formatDateVN(data.endDateStr)} (${data.mode === "day" ? "Theo ngày" : data.mode === "month" ? "Theo tháng" : "Theo tuần"})</span>
    <span>🏪 <strong>Cửa hàng:</strong> ${data.storeFilterName || "Tất cả cửa hàng"}</span>
    <span>👤 <strong>Nhân viên:</strong> ${data.employeeFilterName || "Tất cả nhân viên"}</span>
  `;
  headerLeft.appendChild(metaRow);
  header.appendChild(headerLeft);

  // Header Right
  const headerRight = document.createElement("div");
  headerRight.style.textAlign = "right";

  const badgeBox = document.createElement("div");
  badgeBox.style.backgroundColor = "#EFF6FF";
  badgeBox.style.border = "1px solid #BFDBFE";
  badgeBox.style.borderRadius = "12px";
  badgeBox.style.padding = "10px 16px";
  badgeBox.style.marginBottom = "6px";
  badgeBox.innerHTML = `
    <div style="font-size: 11px; font-weight: 700; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.05em;">TỔNG QUAN PHÂN CÔNG</div>
    <div style="font-size: 16px; font-weight: 800; color: #1E3A8A; margin-top: 2px;">
      ${assignedCount}/${filteredSlots.length} ca đã xếp
      ${emptyCount > 0 ? `<span style="color: #D97706; font-size: 13px; font-weight: 600; margin-left: 6px;">(${emptyCount} ca trống)</span>` : ""}
    </div>
  `;
  headerRight.appendChild(badgeBox);

  const exportTime = document.createElement("div");
  exportTime.innerText = `Xuất lúc: ${format(new Date(), "HH:mm dd/MM/yyyy")}`;
  exportTime.style.fontSize = "11px";
  exportTime.style.color = "#94A3B8";
  headerRight.appendChild(exportTime);

  header.appendChild(headerRight);
  card.appendChild(header);

  // 6. Main Horizontal Table
  const tableWrapper = document.createElement("div");
  tableWrapper.style.boxSizing = "border-box";
  tableWrapper.style.width = `${tableWidth}px`;
  tableWrapper.style.overflow = "visible";

  const table = document.createElement("table");
  table.style.boxSizing = "border-box";
  table.style.width = `${tableWidth}px`;
  table.style.minWidth = `${tableWidth}px`;
  table.style.maxWidth = `${tableWidth}px`;
  table.style.tableLayout = "fixed";
  table.style.borderCollapse = "separate";
  table.style.borderSpacing = "0";
  table.style.fontSize = "12px";
  table.style.borderRadius = "12px";
  table.style.overflow = "hidden";
  table.style.border = "1px solid #CBD5E1";

  // 6.1 Thead
  const thead = document.createElement("thead");
  const theadRow = document.createElement("tr");

  // Col 1: Shift info
  const thShift = document.createElement("th");
  thShift.innerText = "CA LÀM & KHUNG GIỜ";
  thShift.style.boxSizing = "border-box";
  thShift.style.width = `${fixedColsWidth}px`;
  thShift.style.minWidth = `${fixedColsWidth}px`;
  thShift.style.maxWidth = `${fixedColsWidth}px`;
  thShift.style.backgroundColor = "#0F172A";
  thShift.style.color = "#FFFFFF";
  thShift.style.fontWeight = "700";
  thShift.style.padding = "14px 16px";
  thShift.style.textAlign = "left";
  thShift.style.borderRight = "1px solid #334155";
  thShift.style.borderBottom = "2px solid #0F172A";
  theadRow.appendChild(thShift);

  // Date Cols
  dates.forEach((dateStr, dIdx) => {
    const dateObj = parseISO(dateStr);
    const dayOfWeek = format(dateObj, "EEEE", { locale: vi });
    const formattedDate = format(dateObj, "dd/MM/yyyy");
    const dayNote = dayNoteMap.get(dateStr);

    const thDate = document.createElement("th");
    thDate.style.boxSizing = "border-box";
    thDate.style.width = `${dateColWidth}px`;
    thDate.style.minWidth = `${dateColWidth}px`;
    thDate.style.maxWidth = `${dateColWidth}px`;
    thDate.style.backgroundColor = "#1E293B";
    thDate.style.color = "#FFFFFF";
    thDate.style.padding = "12px 14px";
    thDate.style.textAlign = "center";
    thDate.style.borderRight = dIdx === dates.length - 1 ? "none" : "1px solid #334155";
    thDate.style.borderBottom = "2px solid #0F172A";

    thDate.innerHTML = `
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #94A3B8; letter-spacing: 0.05em;">${dayOfWeek}</div>
      <div style="font-size: 14px; font-weight: 800; color: #FFFFFF; margin-top: 2px;">${formattedDate}</div>
      ${dayNote ? `<div style="font-size: 10px; font-weight: 600; background: #FEF3C7; color: #92400E; border-radius: 4px; padding: 2px 6px; margin-top: 4px; display: inline-block;">${dayNote}</div>` : ""}
    `;
    theadRow.appendChild(thDate);
  });

  thead.appendChild(theadRow);
  table.appendChild(thead);

  // 6.2 Tbody
  const tbody = document.createElement("tbody");

  filteredStores.forEach((store) => {
    const storeShifts = data.shifts.filter((s) => s.storeId === store.id);
    if (storeShifts.length === 0) return;

    // Store Section Banner Row
    const storeBannerRow = document.createElement("tr");
    const storeBannerCell = document.createElement("td");
    storeBannerCell.colSpan = 1 + dates.length;
    storeBannerCell.style.boxSizing = "border-box";
    storeBannerCell.style.backgroundColor = "#F1F5F9";
    storeBannerCell.style.padding = "12px 16px";
    storeBannerCell.style.fontWeight = "800";
    storeBannerCell.style.fontSize = "13px";
    storeBannerCell.style.color = "#1E3A8A";
    storeBannerCell.style.borderTop = "1px solid #CBD5E1";
    storeBannerCell.style.borderBottom = "1px solid #CBD5E1";
    storeBannerCell.innerHTML = `🏪 <strong>${store.name.toUpperCase()}</strong> ${store.address ? `<span style="font-weight: 400; color: #64748B; font-size: 12px; margin-left: 8px;">(${store.address})</span>` : ""}`;
    storeBannerRow.appendChild(storeBannerCell);
    tbody.appendChild(storeBannerRow);

    // Shift rows
    storeShifts.forEach((shift, shiftIdx) => {
      const row = document.createElement("tr");
      const isEven = shiftIdx % 2 === 0;
      row.style.backgroundColor = isEven ? "#FFFFFF" : "#F8FAFC";

      // Col 1: Shift info
      const tdShift = document.createElement("td");
      tdShift.style.boxSizing = "border-box";
      tdShift.style.padding = "12px 16px";
      tdShift.style.borderRight = "1px solid #E2E8F0";
      tdShift.style.borderBottom = "1px solid #E2E8F0";
      tdShift.style.verticalAlign = "middle";
      tdShift.style.width = `${fixedColsWidth}px`;
      tdShift.style.minWidth = `${fixedColsWidth}px`;
      tdShift.style.maxWidth = `${fixedColsWidth}px`;
      tdShift.innerHTML = `
        <div style="font-weight: 700; color: #0F172A; font-size: 13px;">${shift.name}</div>
        <div style="font-size: 11px; color: #64748B; font-weight: 500; margin-top: 2px;">⏰ ${shift.startTime} - ${shift.endTime} (${shift.durationHours} tiếng)</div>
      `;
      row.appendChild(tdShift);

      // Date cells
      dates.forEach((dateStr, dIdx) => {
        const tdCell = document.createElement("td");
        tdCell.style.boxSizing = "border-box";
        tdCell.style.padding = "8px 10px";
        tdCell.style.borderRight = dIdx === dates.length - 1 ? "none" : "1px solid #E2E8F0";
        tdCell.style.borderBottom = "1px solid #E2E8F0";
        tdCell.style.verticalAlign = "top";
        tdCell.style.width = `${dateColWidth}px`;
        tdCell.style.minWidth = `${dateColWidth}px`;
        tdCell.style.maxWidth = `${dateColWidth}px`;

        const matchingSlots = filteredSlots.filter(
          (s) => s.storeId === store.id && s.shiftTemplateId === shift.id && s.date.startsWith(dateStr)
        );

        const matchingOvertimes = data.overtimes.filter(
          (ot) => ot.storeId === store.id && ot.shiftTemplateId === shift.id && ot.date.startsWith(dateStr)
        );

        if (matchingSlots.length > 0) {
          const cardBox = document.createElement("div");
          const hasAssigned = matchingSlots.some((s) => Boolean(s.employeeId));

          cardBox.style.boxSizing = "border-box";
          cardBox.style.width = "100%";
          cardBox.style.borderRadius = "8px";
          cardBox.style.padding = "8px 10px";
          cardBox.style.border = hasAssigned ? "1px solid #BFDBFE" : "1px dashed #CBD5E1";
          cardBox.style.backgroundColor = hasAssigned ? "#EFF6FF" : "#F8FAFC";
          cardBox.style.display = "flex";
          cardBox.style.flexDirection = "column";
          cardBox.style.gap = "6px";

          matchingSlots.forEach((slot) => {
            if (slot.employeeId) {
              const emp = employeeMap.get(slot.employeeId);
              const ot = matchingOvertimes.find((o) => o.employeeId === slot.employeeId);
              const hasFaults = slot.faults && slot.faults.length > 0;

              const empRow = document.createElement("div");
              empRow.style.boxSizing = "border-box";
              empRow.style.display = "flex";
              empRow.style.flexDirection = "column";
              empRow.style.gap = "2px";
              empRow.style.backgroundColor = "#FFFFFF";
              empRow.style.padding = "6px 8px";
              empRow.style.borderRadius = "6px";
              empRow.style.border = "1px solid #DBEAFE";

              const nameText = document.createElement("div");
              nameText.innerText = emp?.name || "Nhân viên";
              nameText.style.fontWeight = "700";
              nameText.style.color = "#1E3A8A";
              nameText.style.fontSize = "12px";
              nameText.style.whiteSpace = "nowrap";
              nameText.style.overflow = "hidden";
              nameText.style.textOverflow = "ellipsis";
              empRow.appendChild(nameText);

              if (ot) {
                const otBadge = document.createElement("span");
                otBadge.innerText = `+${ot.hours}h tăng ca`;
                otBadge.style.fontSize = "10px";
                otBadge.style.fontWeight = "700";
                otBadge.style.color = "#D97706";
                otBadge.style.backgroundColor = "#FEF3C7";
                otBadge.style.borderRadius = "4px";
                otBadge.style.padding = "1px 5px";
                otBadge.style.display = "inline-block";
                otBadge.style.marginTop = "2px";
                empRow.appendChild(otBadge);
              }

              if (hasFaults) {
                const faultBadge = document.createElement("span");
                faultBadge.innerText = `⚠️ ${slot.faults!.length} lỗi ghi nhận`;
                faultBadge.style.fontSize = "10px";
                faultBadge.style.fontWeight = "600";
                faultBadge.style.color = "#DC2626";
                faultBadge.style.marginTop = "2px";
                empRow.appendChild(faultBadge);
              }

              cardBox.appendChild(empRow);
            } else {
              const emptyText = document.createElement("div");
              emptyText.innerText = "— Ca trống —";
              emptyText.style.fontSize = "11px";
              emptyText.style.fontStyle = "italic";
              emptyText.style.fontWeight = "600";
              emptyText.style.color = "#D97706";
              emptyText.style.padding = "4px 0";
              cardBox.appendChild(emptyText);
            }
          });

          // Required Staff Badge
          const reqBadge = document.createElement("div");
          const reqStaff = matchingSlots[0]?.requiredStaff ?? matchingSlots.length;
          reqBadge.innerText = `${reqStaff} người/ca`;
          reqBadge.style.fontSize = "10px";
          reqBadge.style.fontWeight = "600";
          reqBadge.style.color = reqStaff > 1 ? "#BE123C" : "#64748B";
          reqBadge.style.marginTop = "2px";
          cardBox.appendChild(reqBadge);

          tdCell.appendChild(cardBox);
        } else {
          tdCell.innerHTML = `<span style="color: #CBD5E1; font-size: 11px;">—</span>`;
        }

        row.appendChild(tdCell);
      });

      tbody.appendChild(row);
    });
  });

  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  card.appendChild(tableWrapper);

  // 7. Footer
  const footer = document.createElement("div");
  footer.style.boxSizing = "border-box";
  footer.style.display = "flex";
  footer.style.justifyContent = "space-between";
  footer.style.alignItems = "center";
  footer.style.borderTop = "1px solid #E2E8F0";
  footer.style.paddingTop = "16px";
  footer.style.marginTop = "20px";
  footer.style.fontSize = "11px";
  footer.style.color = "#94A3B8";
  footer.style.width = "100%";

  footer.innerHTML = `
    <span>© 2026 ApexFlow Inc. Bảo lưu mọi quyền. | Nền tảng quản trị nhân sự chuỗi cửa hàng</span>
    <span>Trang quản trị: apexflow.id.vn</span>
  `;
  card.appendChild(footer);

  root.appendChild(card);
  document.body.appendChild(root);

  try {
    // Show off-screen container to rasterize
    root.style.opacity = "1";

    const dataUrl = await toPng(card, {
      quality: 1,
      pixelRatio: 2, // Crisp 2x HD
      backgroundColor: "#FFFFFF",
      cacheBust: true,
    });

    const link = document.createElement("a");
    link.download = `lich_xep_ca_${data.startDateStr}_${data.endDateStr}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    document.body.removeChild(root);
  }
}
