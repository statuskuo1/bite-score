import { useEffect, useState } from "react";

export function MouthLogo() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOpen((o) => !o), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "#3C1F13",
        border: "1.5px solid #F0997B",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 10, left: 10, width: 6, height: 7, borderRadius: "50%", background: "#F1EFE8" }} />
      <div style={{ position: "absolute", top: 11, left: 12, width: 3, height: 3, borderRadius: "50%", background: "#2C2C2A" }} />
      <div style={{ position: "absolute", top: 10, right: 10, width: 6, height: 7, borderRadius: "50%", background: "#F1EFE8" }} />
      <div style={{ position: "absolute", top: 11, right: 12, width: 3, height: 3, borderRadius: "50%", background: "#2C2C2A" }} />
      <div style={{ position: "absolute", bottom: 4, left: 8, right: 8, height: 12, borderRadius: 6, background: "#D85A30", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#F1EFE8" }} />
        {open && <div style={{ position: "absolute", top: 3, left: 0, right: 0, bottom: 3, background: "#7A1A1A" }} />}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#F1EFE8" }} />
      </div>
    </div>
  );
}
