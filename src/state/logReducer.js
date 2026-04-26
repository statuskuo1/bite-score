export function reducer(s, a) {
  switch (a.type) {
    case "ADD":
      return { ...s, entries: [...s.entries, a.e], view: "log" };
    case "DEL":
      return { ...s, entries: s.entries.filter((e) => e.id !== a.id) };
    case "UPD":
      return { ...s, entries: s.entries.map((e) => (e.id === a.e.id ? a.e : e)), view: "log" };
    case "VIEW":
      return { ...s, view: a.view };
    case "LOAD":
      return { ...s, entries: a.entries };
    default:
      return s;
  }
}
