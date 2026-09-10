export type AuditLogScope = "NONE" | "SELF" | "CUSTOM" | "ALL";

export type AuditLogPermissionConfig = {
  scope: AuditLogScope;
  allowedUserIds?: string[];
  allowedEmails?: string[];
};

export function getAuditLogScope(
  role: string,
  permissions: any
): { scope: AuditLogScope; allowedUserIds: string[]; allowedEmails: string[] } {
  if (role === "OWNER" || role === "ADMIN") {
    return { scope: "ALL", allowedUserIds: [], allowedEmails: [] };
  }

  const hasCustomPermissions = permissions !== null && permissions !== undefined && typeof permissions === "object";

  if (hasCustomPermissions) {
    const perm = permissions.audit_log;
    if (!perm || perm === "NONE") {
      return { scope: "NONE", allowedUserIds: [], allowedEmails: [] };
    }

    if (typeof perm === "string") {
      if (perm === "ALL" || perm === "VIEW") return { scope: "ALL", allowedUserIds: [], allowedEmails: [] };
      if (perm === "SELF") return { scope: "SELF", allowedUserIds: [], allowedEmails: [] };
      if (perm === "CUSTOM") return { scope: "CUSTOM", allowedUserIds: [], allowedEmails: [] };
      return { scope: "NONE", allowedUserIds: [], allowedEmails: [] };
    }

    if (typeof perm === "object") {
      const scope: AuditLogScope = perm.scope || (perm.view ? "ALL" : "NONE");
      const allowedUserIds = Array.isArray(perm.allowedUserIds) ? perm.allowedUserIds : [];
      const allowedEmails = Array.isArray(perm.allowedEmails) ? perm.allowedEmails : [];
      return { scope, allowedUserIds, allowedEmails };
    }
  }

  // Base role fallback: only OWNER and ADMIN can view audit logs by default. EMPLOYEE/SCHEDULER have scope NONE unless explicitly granted.
  return { scope: "NONE", allowedUserIds: [], allowedEmails: [] };
}

export function hasPermission(
  role: string,
  permissions: any,
  module: string,
  action: "VIEW" | "EDIT" | "APPROVE" | "REQUEST" | "EDIT_FREE" | "DELETE" | "VIEW_LIST" | "VIEW_HOURS" | "EDIT_PAST"
): boolean {
  if (role === "OWNER") return true;

  if (module === "audit_log") {
    const auditScope = getAuditLogScope(role, permissions);
    if (action === "VIEW") {
      return auditScope.scope !== "NONE";
    }
    // Audit logs are immutable and cannot be edited or deleted
    return false;
  }

  const hasCustomPermissions = permissions !== null && permissions !== undefined && typeof permissions === "object";

  if (hasCustomPermissions) {
    let perm = permissions[module];

    // If perm is undefined for this module in a custom permissions configuration, access is DENIED
    if (!perm) return false;

    // Auto-migrate legacy string permissions to new Object structure
    if (typeof perm === "string") {
      if (perm === "NONE") return false;
      if (module === "schedule") {
        if (perm === "APPROVER") perm = { view: true, edit: true, editFree: true, approve: true };
        else if (perm === "EDIT_FREE" || perm === "EDIT") perm = { view: true, edit: true, editFree: true, approve: false };
        else if (perm === "EDIT_REQUEST") perm = { view: true, edit: true, editFree: false, approve: false };
        else if (perm === "VIEW") perm = { view: true, edit: false, editFree: false, approve: false };
        else perm = {};
      } else {
        if (perm === "EDIT") perm = { view: true, edit: true, delete: true };
        else if (perm === "VIEW") perm = { view: true, edit: false, delete: false };
        else perm = {};
      }
    }

    if (perm && typeof perm === "object") {
      if (module === "schedule") {
        if (action === "VIEW") return perm.view === true || perm.edit === true || perm.editFree === true || perm.approve === true;
        if (action === "EDIT") return perm.edit === true || perm.editFree === true || perm.approve === true;
        if (action === "EDIT_FREE") return perm.editFree === true;
        if (action === "APPROVE") return perm.approve === true;
        if (action === "REQUEST") return perm.edit === true;
        if (action === "EDIT_PAST") return perm.editPast === true;
        return false;
      }
      
      if (module === "employees") {
        if (action === "VIEW") return perm.viewList === true || perm.viewHours === true || perm.edit === true || perm.delete === true;
        if (action === "VIEW_LIST") return perm.viewList === true || perm.edit === true || perm.delete === true;
        if (action === "VIEW_HOURS") return perm.viewHours === true || perm.edit === true || perm.delete === true;
        if (action === "EDIT") return perm.edit === true || perm.delete === true;
        if (action === "DELETE") return perm.delete === true;
        return false;
      }

      if (module === "shift_config") {
        if (action === "VIEW") return perm.view === true || perm.edit === true || perm.delete === true;
        if (action === "EDIT") return perm.edit === true || perm.delete === true;
        if (action === "DELETE") return perm.delete === true;
        if (action === "EDIT_PAST") return perm.editPast === true;
        return false;
      }

      // Generic logic for store, settings, products, revenue, etc.
      if (action === "VIEW") return perm.view === true || perm.edit === true || perm.delete === true;
      if (action === "EDIT") return perm.edit === true || perm.delete === true;
      if (action === "DELETE") return perm.delete === true;
      return false;
    }

    return false;
  }

  // Fallback for default base roles when NO custom permissions have been configured (permissions is null or undefined)
  if (role === "ADMIN") return true;
  if (role === "SCHEDULER" && (module === "schedule" || module === "shift_config")) {
    if (action === "EDIT_PAST") return false;
    return true;
  }
  if (role === "EMPLOYEE" && module === "schedule" && action === "VIEW") return true;

  return false;
}

export function summarizePermissionsInVietnamese(
  permissions: any,
  role?: string,
  customRoleName?: string | null
): { roleTitle: string; moduleList: string[]; summaryText: string } {
  let roleTitle = "Nhân viên (Mặc định)";
  if (role === "OWNER") roleTitle = "Chủ sở hữu (Toàn quyền)";
  else if (role === "ADMIN") roleTitle = "Quản trị viên (Toàn quyền)";
  else if (role === "SCHEDULER") roleTitle = "Quản lý xếp ca";
  else if (customRoleName) roleTitle = customRoleName;

  if (role === "OWNER" || role === "ADMIN") {
    return {
      roleTitle,
      moduleList: ["Toàn quyền tất cả các phân hệ"],
      summaryText: `${roleTitle}: Toàn quyền tất cả các phân hệ`,
    };
  }

  const moduleList: string[] = [];

  if (!permissions || typeof permissions !== "object" || Object.keys(permissions).length === 0) {
    return {
      roleTitle,
      moduleList: ["Chưa được cấp quyền phân hệ nào"],
      summaryText: `${roleTitle} • Không có quyền phân hệ`,
    };
  }

  // 1. schedule
  const sch = permissions.schedule;
  if (sch) {
    const pastSuffix = sch.editPast ? " (gồm lịch sử)" : "";
    if (sch === "APPROVER" || sch.approve) moduleList.push(`Lịch xếp ca: Toàn quyền & Duyệt yêu cầu${pastSuffix}`);
    else if (sch === "EDIT_FREE" || sch.editFree) moduleList.push(`Lịch xếp ca: Toàn quyền xếp ca${pastSuffix}`);
    else if (sch === "EDIT" || sch.edit) moduleList.push(`Lịch xếp ca: Chỉnh sửa${pastSuffix}`);
    else if (sch === "VIEW" || sch.view) moduleList.push("Lịch xếp ca: Chỉ xem");
  }

  // 2. store
  const st = permissions.store;
  if (st) {
    if (st.delete) moduleList.push("Cửa hàng: Xem, Sửa & Xoá");
    else if (st.edit || st === "EDIT") moduleList.push("Cửa hàng: Xem & Sửa");
    else if (st.view || st === "VIEW") moduleList.push("Cửa hàng: Chỉ xem");
  }

  // 3. products
  const pr = permissions.products;
  if (pr) {
    if (pr.delete) moduleList.push("Hàng hoá: Xem, Sửa & Xoá");
    else if (pr.edit || pr === "EDIT") moduleList.push("Hàng hoá: Xem & Sửa");
    else if (pr.view || pr === "VIEW") moduleList.push("Hàng hoá: Chỉ xem");
  }

  // 4. revenue
  const rev = permissions.revenue;
  if (rev) {
    if (rev.delete) moduleList.push("Đơn hàng & Bán hàng: Xem, Sửa & Huỷ");
    else if (rev.edit || rev === "EDIT") moduleList.push("Đơn hàng & Bán hàng: Xem & Tạo/Sửa đơn");
    else if (rev.view || rev === "VIEW") moduleList.push("Đơn hàng & Bán hàng: Chỉ xem");
  }

  // 5. employees
  const emp = permissions.employees;
  if (emp) {
    const parts = [];
    if (emp.viewList) parts.push("Xem danh sách");
    if (emp.viewHours) parts.push("Xem giờ làm");
    if (emp.edit) parts.push("Chỉnh sửa");
    if (emp.delete) parts.push("Xoá nhân sự");
    if (parts.length > 0) moduleList.push(`Nhân sự: ${parts.join(", ")}`);
    else if (emp.view || emp === "VIEW") moduleList.push("Nhân sự: Chỉ xem");
  }

  // 6. shift_config
  const sc = permissions.shift_config;
  if (sc) {
    const pastSuffix = sc.editPast ? " (gồm lịch sử)" : "";
    if (sc.delete) moduleList.push(`Cấu hình ca: Xem, Sửa & Xoá ca${pastSuffix}`);
    else if (sc.edit || sc === "EDIT") moduleList.push(`Cấu hình ca: Xem & Sửa ca${pastSuffix}`);
    else if (sc.view || sc === "VIEW") moduleList.push("Cấu hình ca: Chỉ xem");
  }

  // 7. settings
  const set = permissions.settings;
  if (set) {
    if (set.edit || set === "EDIT") moduleList.push("Cài đặt & Phân quyền: Toàn quyền quản trị");
    else if (set.view || set === "VIEW") moduleList.push("Cài đặt & Phân quyền: Chỉ xem");
  }

  // 8. audit_log
  const audit = permissions.audit_log;
  if (audit) {
    if (audit.scope === "ALL" || audit === "ALL") moduleList.push("Lịch sử thao tác: Xem toàn bộ hệ thống");
    else if (audit.scope === "CUSTOM" || audit === "CUSTOM") moduleList.push("Lịch sử thao tác: Xem nhân sự chỉ định");
    else if (audit.scope === "SELF" || audit === "SELF") moduleList.push("Lịch sử thao tác: Chỉ xem của chính mình");
  }

  if (moduleList.length === 0) {
    moduleList.push("Không có quyền phân hệ nào");
  }

  return {
    roleTitle,
    moduleList,
    summaryText: `${roleTitle} • ${moduleList.join(" | ")}`,
  };
}

