export function hasPermission(
  role: string,
  permissions: any,
  module: string,
  action: "VIEW" | "EDIT" | "APPROVE" | "REQUEST" | "EDIT_FREE" | "DELETE" | "VIEW_LIST" | "VIEW_HOURS"
): boolean {
  if (role === "OWNER") return true;

  if (permissions !== null && permissions !== undefined && typeof permissions === "object") {
    let perm = permissions[module];

    // Auto-migrate legacy string permissions to new Object structure
    if (typeof perm === "string") {
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
        if (action === "VIEW") return perm.view === true || perm.edit === true;
        if (action === "EDIT") return perm.edit === true;
        if (action === "EDIT_FREE") return perm.editFree === true;
        if (action === "APPROVE") return perm.approve === true;
        if (action === "REQUEST") return perm.edit === true;
        return false;
      }
      
      if (module === "employees") {
        if (action === "VIEW") return perm.viewList === true || perm.viewHours === true || perm.edit === true;
        if (action === "VIEW_LIST") return perm.viewList === true || perm.edit === true;
        if (action === "VIEW_HOURS") return perm.viewHours === true || perm.edit === true;
        if (action === "EDIT") return perm.edit === true;
        if (action === "DELETE") return perm.delete === true;
        return false;
      }

      // Generic logic for store, shift_config, settings, etc.
      if (action === "VIEW") return perm.view === true || perm.edit === true;
      if (action === "EDIT") return perm.edit === true;
      if (action === "DELETE") return perm.delete === true;
      return false;
    }

    return false;
  }

  // Fallback for legacy records that don't have the permissions JSON
  if (role === "ADMIN") return true;
  if (role === "SCHEDULER" && (module === "schedule" || module === "shift_config")) return true;
  if (action === "VIEW" && (module === "schedule" || module === "store")) return true;

  return false;
}
