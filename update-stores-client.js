const fs = require('fs');
const path = 'src/app/app/[companyId]/cua-hang/stores-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add imports
const importsToAdd = `import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
`;

content = content.replace('import { useNotifications } from "@/components/notifications/notification-center";', 
  'import { useNotifications } from "@/components/notifications/notification-center";\n' + importsToAdd);

// Add SortableStoreCard component right after Store type
const sortableComponent = `
function SortableStoreCard({
  store, canEdit, editingNameFor, setEditingNameFor, editName, setEditName, handleSaveName, handleDelete, handleLogoChange, editingShiftsFor, setEditingShiftsFor, editShiftsPerDay, setEditShiftsPerDay, handleSaveShifts, LOGO_ACCEPT
}: any) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: store.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'shadow-xl ring-2 ring-primary border-primary' : ''}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          {canEdit && (
            <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 p-1 -ml-2">
              <GripVertical size={20} />
            </div>
          )}
          <label className="flex cursor-pointer items-center flex-col gap-1">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 hover:border-blue-400 transition-colors">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" />
              ) : (
                <span>Logo</span>
              )}
            </span>
            {canEdit && (
              <>
                <span className="text-[10px] font-medium text-blue-600">Đổi logo</span>
                <input
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    await handleLogoChange(store, file);
                  }}
                />
              </>
            )}
          </label>
          <div>
            {editingNameFor === store.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 w-40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSaveName(store);
                    } else if (e.key === "Escape") {
                      setEditingNameFor(null);
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={() => handleSaveName(store)}>Lưu</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNameFor(null)}>Hủy</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CardTitle>{store.name}</CardTitle>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingNameFor(store.id);
                      setEditName(store.name);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <Button size="sm" variant="destructive" onClick={() => handleDelete(store.id, store.name)}>
            Xóa
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>{store.address || "Chưa có địa chỉ"}</p>
        <p>{store._count?.employees ?? 0} nhân viên phụ trách</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
          {editingShiftsFor === store.id ? (
            <>
              <span className="text-slate-600">Số ca/ngày:</span>
              <Input
                type="number"
                min="1"
                value={editShiftsPerDay}
                onChange={(e) => setEditShiftsPerDay(e.target.value)}
                className="w-20 h-8"
              />
              <Button size="sm" onClick={() => handleSaveShifts(store.id)}>Lưu</Button>
              <Button size="sm" variant="outline" onClick={() => setEditingShiftsFor(null)}>Hủy</Button>
            </>
          ) : (
            <>
              <span>{store.shiftsPerDay ?? 3} ca/ngày · {store.shiftTemplates?.length ?? 0} ca đã cấu hình</span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditingShiftsFor(store.id);
                    setEditShiftsPerDay(String(store.shiftsPerDay ?? 3));
                  }}
                >
                  Sửa số ca
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
`;

content = content.replace('const MAX_LOGO_SIZE_MB = 10;', 'const MAX_LOGO_SIZE_MB = 10;\n' + sortableComponent);

// Add state for local sorting
content = content.replace('  const { data: stores = [], mutate: load, error } = useSWR("/api/stores", fetcher);', 
`  const { data: storesData = [], mutate: load, error } = useSWR("/api/stores", fetcher);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    if (storesData) {
      setStores(storesData);
    }
  }, [storesData]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStores((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save new order to backend
        fetch("/api/stores/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeIds: newItems.map(s => s.id) })
        }).catch(err => console.error("Failed to save reorder", err));

        return newItems;
      });
    }
  }
`);

// Replace render loop
const regexRenderLoop = /<div className="grid gap-4 md:grid-cols-2">[\s\S]*?(?=<\/div>\s*<\/div>\s*\);)/;

const newRenderLoop = `<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stores.map(s => s.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 md:grid-cols-2">
            {stores.map((store) => (
              <SortableStoreCard
                key={store.id}
                store={store}
                canEdit={canEdit}
                editingNameFor={editingNameFor}
                setEditingNameFor={setEditingNameFor}
                editName={editName}
                setEditName={setEditName}
                handleSaveName={handleSaveName}
                handleDelete={handleDelete}
                handleLogoChange={handleLogoChange}
                editingShiftsFor={editingShiftsFor}
                setEditingShiftsFor={setEditingShiftsFor}
                editShiftsPerDay={editShiftsPerDay}
                setEditShiftsPerDay={setEditShiftsPerDay}
                handleSaveShifts={handleSaveShifts}
                LOGO_ACCEPT={LOGO_ACCEPT}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>`;

content = content.replace(regexRenderLoop, newRenderLoop + '\n    ');

fs.writeFileSync(path, content);
console.log('Done rewriting stores-client.tsx');
