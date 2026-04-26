export function Pill({active,children,onClick}) {
  return <div onClick={onClick} style={{padding:"4px 10px",borderRadius:14,border:"none",fontSize:11,cursor:"pointer",transition:"all 0.15s",background:active?"#F0997B":"transparent",color:active?"#141413":"#888780",fontWeight:active?500:400}}>{children}</div>;
}