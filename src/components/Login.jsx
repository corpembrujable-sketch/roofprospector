// components/Login.jsx
export default function Login({ onLogin }) {
  return (
    <div style={{ minHeight:'100vh', background:'#060c18', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:420, background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:20, padding:40, boxShadow:'0 24px 80px rgba(0,0,0,.7)' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:13, letterSpacing:3, color:'#2563eb', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>RoofProspector</div>
          <div style={{ fontSize:26, fontWeight:700, color:'#f1f5f9', lineHeight:1.2 }}>Sistema de<br/>Prospectacion</div>
          <div style={{ fontSize:12, color:'#475569', marginTop:6 }}>Solo direcciones verificadas -- Raleigh NC</div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label className="lbl">Email</label>
          <input className="inp" type="email" defaultValue="admin@roofsales.com" />
        </div>
        <div style={{ marginBottom:22 }}>
          <label className="lbl">Contrasena</label>
          <input className="inp" type="password" defaultValue="demo1234" />
        </div>
        <button className="btn-primary" style={{ width:'100%', padding:13, fontSize:14 }} onClick={onLogin}>
          Entrar
        </button>
        <div style={{ textAlign:'center', marginTop:10, color:'#334155', fontSize:11 }}>Modo demo -- cualquier credencial</div>
      </div>
    </div>
  )
}
