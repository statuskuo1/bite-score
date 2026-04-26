export function Toggle({on,onClick}) {
  return (
    <div onClick={onClick} style={{width:36,height:20,borderRadius:10,background:on?"#F0997B":"#444441",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:on?18:3,width:14,height:14,borderRadius:7,background:"#fff",transition:"left 0.2s"}}/>
    </div>
  );
}