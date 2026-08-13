const fs = require('fs');
const path = 'src/app/app/[companyId]/cai-dat/roles-management.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update updatePermission
content = content.replace(
  'const updatePermission = (moduleId: string, value: string) => {',
  'const updatePermission = (moduleId: string, value: any) => {'
);

const newMap = `{MODULES.map((mod) => {
                  const currentValue = permissions[mod.id] || "NONE";

                  if (mod.id === "schedule") {
                    return (
                      <div key={mod.id} className="flex flex-col p-3 rounded-lg border bg-slate-50/50 gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-md shadow-sm text-indigo-500 border border-indigo-100">
                            <mod.icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-slate-700 text-sm">{mod.label}</span>
                        </div>
                        <div className="ml-10">
                          <Select
                            value={typeof currentValue === "string" ? currentValue : "NONE"}
                            onChange={(e) => updatePermission(mod.id, e.target.value)}
                          >
                            <option value="APPROVER">Người Xác nhận yêu cầu (Toàn quyền xếp ca & duyệt)</option>
                            <option value="EDIT_FREE">Chỉnh sửa tự do (Toàn quyền xếp ca)</option>
                            <option value="EDIT_REQUEST">Gửi yêu cầu xác nhận (Phải gửi duyệt nếu vượt rule)</option>
                            <option value="VIEW">Chỉ xem</option>
                            <option value="NONE">Không có quyền</option>
                          </Select>
                        </div>
                      </div>
                    );
                  }

                  if (mod.id === "employees") {
                    const empPerm = (typeof currentValue === "object" && currentValue !== null) ? currentValue : {};
                    const isNone = currentValue === "NONE" || Object.keys(empPerm).length === 0;
                    
                    const toggleSubPerm = (key, value) => {
                      let newEmpPerm = { ...empPerm, [key]: value };
                      if (isNone) newEmpPerm = { [key]: value };
                      
                      if (key === "edit" && !value) newEmpPerm.delete = false;
                      
                      if (!newEmpPerm.viewList && !newEmpPerm.viewHours && !newEmpPerm.edit && !newEmpPerm.delete) {
                        updatePermission(mod.id, "NONE");
                      } else {
                        updatePermission(mod.id, newEmpPerm);
                      }
                    };

                    return (
                      <div key={mod.id} className="flex flex-col p-3 rounded-lg border bg-slate-50/50 gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-md shadow-sm text-indigo-500 border border-indigo-100">
                            <mod.icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-slate-700 text-sm">{mod.label}</span>
                        </div>
                        <div className="ml-10 bg-white border rounded-lg p-3 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-700 mb-1">Chỉ xem</p>
                            <div className="space-y-1 ml-1">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!empPerm.viewList || !!empPerm.edit} disabled={!!empPerm.edit} onChange={(e) => toggleSubPerm("viewList", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                Danh sách nhân viên {!!empPerm.edit && "(Mặc định khi có sửa)"}
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!empPerm.viewHours || !!empPerm.edit} disabled={!!empPerm.edit} onChange={(e) => toggleSubPerm("viewHours", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                Giờ làm thực tế trong tháng {!!empPerm.edit && "(Mặc định khi có sửa)"}
                              </label>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700 mb-1">Được chỉnh sửa</p>
                            <div className="space-y-1 ml-1">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!empPerm.edit} onChange={(e) => toggleSubPerm("edit", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                Chỉnh sửa thông tin
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!empPerm.delete} disabled={!empPerm.edit} onChange={(e) => toggleSubPerm("delete", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                Xoá nhân viên
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                  <div key={mod.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-md shadow-sm text-indigo-500 border border-indigo-100">
                        <mod.icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-slate-700 text-sm">{mod.label}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updatePermission(mod.id, "NONE")}
                        className={\`px-3 py-1 text-xs font-medium rounded-md transition-colors \${
                          !permissions[mod.id] || permissions[mod.id] === "NONE"
                            ? "bg-slate-200 text-slate-800"
                            : "text-slate-500 hover:bg-slate-100"
                        }\`}
                      >
                        Không
                      </button>
                      <button
                        onClick={() => updatePermission(mod.id, "VIEW")}
                        className={\`px-3 py-1 text-xs font-medium rounded-md transition-colors \${
                          permissions[mod.id] === "VIEW"
                            ? "bg-blue-100 text-blue-700 border-blue-200 border"
                            : "text-slate-500 hover:bg-slate-100 border border-transparent"
                        }\`}
                      >
                        Chỉ xem
                      </button>
                      <button
                        onClick={() => updatePermission(mod.id, "EDIT")}
                        className={\`px-3 py-1 text-xs font-medium rounded-md transition-colors \${
                          permissions[mod.id] === "EDIT"
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200 border"
                            : "text-slate-500 hover:bg-slate-100 border border-transparent"
                        }\`}
                      >
                        Chỉnh sửa
                      </button>
                    </div>
                  </div>
                )})}`;

const regex = /\{MODULES\.map\(\(mod\) => \([\s\S]*?(?=\s*\}\)\})/;
if (regex.test(content)) {
  content = content.replace(regex, newMap);
  fs.writeFileSync(path, content);
  console.log('Patched roles-management.tsx');
} else {
  console.log('Regex did not match');
}
