const fs = require('fs');

const path = 'src/app/app/[companyId]/cai-dat/member-permissions-sheet.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the standard module map with specialized ones
const newMap = `                  {MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const currentValue = permissions[mod.id] || "NONE";
                    
                    if (mod.id === "schedule") {
                      return (
                        <div key={mod.id} className="space-y-3">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <Icon className="h-4 w-4 text-slate-400" />
                            {mod.label}
                          </div>
                          <div className="flex flex-col gap-2">
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
                        
                        // If turning off edit, must turn off delete
                        if (key === "edit" && !value) newEmpPerm.delete = false;
                        
                        // If all are false, set to NONE
                        if (!newEmpPerm.viewList && !newEmpPerm.viewHours && !newEmpPerm.edit && !newEmpPerm.delete) {
                          updatePermission(mod.id, "NONE");
                        } else {
                          updatePermission(mod.id, newEmpPerm);
                        }
                      };

                      return (
                        <div key={mod.id} className="space-y-3">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <Icon className="h-4 w-4 text-slate-400" />
                            {mod.label}
                          </div>
                          <div className="bg-slate-50 border rounded-lg p-4 space-y-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Chỉ xem</p>
                              <div className="space-y-2 ml-2">
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                  <input type="checkbox" checked={!!empPerm.viewList || !!empPerm.edit} disabled={!!empPerm.edit} onChange={(e) => toggleSubPerm("viewList", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                  Danh sách nhân viên {!!empPerm.edit && "(Mặc định khi có quyền sửa)"}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                  <input type="checkbox" checked={!!empPerm.viewHours || !!empPerm.edit} disabled={!!empPerm.edit} onChange={(e) => toggleSubPerm("viewHours", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                  Giờ làm thực tế trong tháng {!!empPerm.edit && "(Mặc định khi có quyền sửa)"}
                                </label>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Được chỉnh sửa</p>
                              <div className="space-y-2 ml-2">
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                  <input type="checkbox" checked={!!empPerm.edit} onChange={(e) => toggleSubPerm("edit", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                  Chỉnh sửa thông tin
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
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
                      <div key={mod.id} className="space-y-3">
                        <div className="flex items-center gap-2 font-medium text-slate-700">
                          <Icon className="h-4 w-4 text-slate-400" />
                          {mod.label}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors flex-1",
                            currentValue === "NONE" ? "bg-slate-50 border-slate-300 shadow-sm" : "border-transparent hover:bg-slate-50"
                          )}>
                            <input 
                              type="radio" 
                              name={mod.id} 
                              checked={currentValue === "NONE"}
                              onChange={() => updatePermission(mod.id, "NONE")}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Không có quyền</span>
                          </label>

                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors flex-1",
                            currentValue === "VIEW" ? "bg-blue-50 border-blue-200 text-blue-800 shadow-sm" : "border-transparent hover:bg-slate-50 text-slate-600"
                          )}>
                            <input 
                              type="radio" 
                              name={mod.id} 
                              checked={currentValue === "VIEW"}
                              onChange={() => updatePermission(mod.id, "VIEW")}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium">Chỉ xem</span>
                          </label>

                          <label className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors flex-1",
                            currentValue === "EDIT" ? "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm" : "border-transparent hover:bg-slate-50 text-slate-600"
                          )}>
                            <input 
                              type="radio" 
                              name={mod.id} 
                              checked={currentValue === "EDIT"}
                              onChange={() => updatePermission(mod.id, "EDIT")}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium">Được sửa</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}`;

const regex = /\{MODULES\.map\(\(mod\) => \{[\s\S]*?(?=\s*\}\)\})/;
if (regex.test(content)) {
  content = content.replace(regex, newMap);
  fs.writeFileSync(path, content);
  console.log('Patched member-permissions-sheet.tsx');
} else {
  console.log('Regex did not match');
}

const path2 = 'src/app/app/[companyId]/cai-dat/roles-management.tsx';
let content2 = fs.readFileSync(path2, 'utf8');
if (regex.test(content2)) {
  content2 = content2.replace(regex, newMap);
  fs.writeFileSync(path2, content2);
  console.log('Patched roles-management.tsx');
} else {
  console.log('Regex did not match in roles-management.tsx');
}
