import os

file_path = "src/components/schedule/schedule-calendar.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'import { FaultModal } from "./fault-modal";\nimport { Badge } from "@/components/ui/badge";',
    'import { FaultModal } from "./fault-modal";\nimport { OvertimeModal } from "./overtime-modal";\nimport { Badge } from "@/components/ui/badge";'
)

# 2. Props
content = content.replace(
    '  dayNotes: DayNote[];\n  unfilled: Unfilled[];',
    '  dayNotes: DayNote[];\n  overtimes: { id: string; storeId: string; shiftTemplateId: string; date: string; employeeId: string; hours: number }[];\n  unfilled: Unfilled[];'
)

# 3. CompactSlotGroup Props
content = content.replace(
    '  flashSlots: Map<string, "success" | "error">;\n  onAssign: (slot: Slot, employeeId: string) => Promise<void>;',
    '  flashSlots: Map<string, "success" | "error">;\n  overtimes: { id: string; employeeId: string; hours: number }[];\n  onAddOvertime: () => void;\n  onEditOvertime: (id: string, employeeId: string, hours: number) => void;\n  onDeleteOvertime: (id: string) => void;\n  onAssign: (slot: Slot, employeeId: string) => Promise<void>;'
)

# 4. CompactSlotGroup Render: button
content = content.replace(
    '          <p className="text-slate-500">{store.name}</p>\n        </div>\n      </div>',
    '''          <p className="text-slate-500">{store.name}</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddOvertime}
            disabled={!hasAssigned || loading}
            className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 focus-visible:ring-1 focus-visible:ring-blue-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title={!hasAssigned ? "Ca trống không thể thêm giờ làm thêm" : "Thêm giờ làm thêm"}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>'''
)

# 5. CompactSlotGroup Render: list
content = content.replace(
    '            })}\n          </div>\n        </div>\n      ) : canEdit ? (',
    '''            })}
          </div>
          {overtimes.length > 0 && (
            <div className="min-w-0 flex-1 space-y-0.5 pt-1">
              {overtimes.map((ot) => {
                const emp = employeeMap.get(ot.employeeId);
                if (!emp) return null;
                return (
                  <div key={ot.id} className="group/ot flex items-center justify-between text-[11px] italic text-slate-500">
                    <span>{emp.name} làm thêm {ot.hours} tiếng</span>
                    {canEdit && (
                      <div className="flex items-center gap-1 opacity-0 group-hover/ot:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEditOvertime(ot.id, ot.employeeId, ot.hours)}
                          disabled={loading}
                          className="text-slate-400 hover:text-blue-600"
                          title="Sửa giờ làm thêm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOvertime(ot.id)}
                          disabled={loading}
                          className="text-slate-400 hover:text-red-600"
                          title="Xoá giờ làm thêm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : canEdit ? ('''
)

# 6. ScheduleCalendar state and handlers
overtime_handlers = '''
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [overtimeModalMode, setOvertimeModalMode] = useState<"add" | "edit">("add");
  const [overtimeSlotContext, setOvertimeSlotContext] = useState<{ storeId: string; shiftTemplateId: string; date: string } | null>(null);
  const [editingOvertimeId, setEditingOvertimeId] = useState<string | null>(null);
  const [editingOvertimeInitialHours, setEditingOvertimeInitialHours] = useState<number | undefined>(undefined);
  const [editingOvertimeEmployeeId, setEditingOvertimeEmployeeId] = useState<string | undefined>(undefined);

  async function submitOvertime(employeeId: string, hours: number) {
    if (!overtimeSlotContext && overtimeModalMode === "add") return;
    
    try {
      const url = overtimeModalMode === "add" ? "/api/schedule/overtime" : `/api/schedule/overtime/${editingOvertimeId}`;
      const method = overtimeModalMode === "add" ? "POST" : "PUT";
      const body = overtimeModalMode === "add" 
        ? { ...overtimeSlotContext, employeeId, hours }
        : { hours };
        
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!res.ok) {
        notify({ title: "Lỗi", body: data.error || "Không thể lưu giờ làm thêm", tone: "error" });
        return;
      }
      
      if (data.pendingApproval) {
        notify({ title: "Chờ duyệt", body: data.message, tone: "warning" });
      } else {
        notify({ title: "Thành công", body: "Đã lưu giờ làm thêm", tone: "success" });
      }
      setOvertimeModalOpen(false);
      onRefresh();
    } catch (e) {
      notify({ title: "Lỗi", body: "Không kết nối được server", tone: "error" });
    }
  }

  async function deleteOvertime(id: string) {
    if (!window.confirm("Bạn có chắc chắn muốn xoá giờ làm thêm này?")) return;
    try {
      const res = await fetch(`/api/schedule/overtime/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        notify({ title: "Lỗi", body: data.error || "Không thể xoá", tone: "error" });
        return;
      }
      if (data.pendingApproval) {
        notify({ title: "Chờ duyệt", body: data.message, tone: "warning" });
      } else {
        notify({ title: "Thành công", body: "Đã xoá giờ làm thêm", tone: "success" });
      }
      onRefresh();
    } catch (e) {
      notify({ title: "Lỗi", body: "Không kết nối được server", tone: "error" });
    }
  }

  async function moveAssignment(
'''
content = content.replace('  async function moveAssignment(', overtime_handlers)

# 7. Add Modal in ScheduleCalendar return
modal_render = '''        />

        <OvertimeModal
          isOpen={overtimeModalOpen}
          mode={overtimeModalMode}
          loading={loading}
          initialEmployeeId={overtimeModalMode === "edit" ? editingOvertimeEmployeeId : undefined}
          initialHours={overtimeModalMode === "edit" ? editingOvertimeInitialHours : undefined}
          employees={overtimeSlotContext ? (eligibleEmployeesByStore.get(overtimeSlotContext.storeId) || []) : []}
          existingEmployeeIds={
            new Set(
              overtimeSlotContext
                ? overtimes
                    .filter((ot) => ot.storeId === overtimeSlotContext.storeId && ot.shiftTemplateId === overtimeSlotContext.shiftTemplateId && ot.date === overtimeSlotContext.date)
                    .map((ot) => ot.employeeId)
                : []
            )
          }
          onClose={() => {
            setOvertimeModalOpen(false);
            if (overtimeModalMode === "add") {
              setOvertimeSlotContext(null);
            }
          }}
          onSubmit={submitOvertime}
        />
      </DndContext>'''
content = content.replace('        />\n      </DndContext>', modal_render)

# 8. Pass props to CompactSlotGroup
props_to_add = '''                                        flashSlots={flashSlots}
                                        overtimes={overtimes.filter((ot) => ot.storeId === store.id && ot.shiftTemplateId === shift.id && ot.date === date)}
                                        onAddOvertime={() => {
                                          setOvertimeSlotContext({ storeId: store.id, shiftTemplateId: shift.id, date });
                                          setOvertimeModalMode("add");
                                          setOvertimeModalOpen(true);
                                        }}
                                        onEditOvertime={(id, empId, hours) => {
                                          setEditingOvertimeId(id);
                                          setEditingOvertimeEmployeeId(empId);
                                          setEditingOvertimeInitialHours(hours);
                                          setOvertimeModalMode("edit");
                                          setOvertimeModalOpen(true);
                                        }}
                                        onDeleteOvertime={deleteOvertime}
                                        onAssign={(slot, id) => assignEmployee(slot, id)}'''
content = content.replace(
    '                                        flashSlots={flashSlots}\n                                        onAssign={(slot, id) => assignEmployee(slot, id)}',
    props_to_add
)

props_to_add2 = '''                                  flashSlots={flashSlots}
                                  overtimes={overtimes.filter((ot) => ot.storeId === store.id && ot.shiftTemplateId === shift.id && ot.date === date)}
                                  onAddOvertime={() => {
                                    setOvertimeSlotContext({ storeId: store.id, shiftTemplateId: shift.id, date });
                                    setOvertimeModalMode("add");
                                    setOvertimeModalOpen(true);
                                  }}
                                  onEditOvertime={(id, empId, hours) => {
                                    setEditingOvertimeId(id);
                                    setEditingOvertimeEmployeeId(empId);
                                    setEditingOvertimeInitialHours(hours);
                                    setOvertimeModalMode("edit");
                                    setOvertimeModalOpen(true);
                                  }}
                                  onDeleteOvertime={deleteOvertime}
                                  onAssign={(slot, id) => assignEmployee(slot, id)}'''
content = content.replace(
    '                                  flashSlots={flashSlots}\n                                  onAssign={(slot, id) => assignEmployee(slot, id)}',
    props_to_add2
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched schedule-calendar.tsx successfully!")
