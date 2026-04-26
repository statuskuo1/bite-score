export function SectionLabel({ children }) {
  return (
    <span
      style={{
        fontSize: 10,
        color: "#F0997B",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        display: "block",
        marginBottom: 10,
      }}
    >
      {children}
    </span>
  );
}
