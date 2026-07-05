async function main() {
  try {
    const res = await fetch("http://localhost:3000/api/schedule?mode=week&date=2026-07-06");
    const data = await res.json();
    const emps = data.employees;
    const deletedEmps = emps.filter(e => e.deletedAt);
    console.log("Deleted employees:");
    console.log(deletedEmps.map(e => ({ name: e.name, deletedAt: e.deletedAt, isActive: e.isActive })));
  } catch (err) {
    console.log("Server not running or error:", err.message);
  }
}
main();
