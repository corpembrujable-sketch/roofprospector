export default function Toast({ toast }) {
  if (!toast) return null
  const bg      = toast.type === 'err' ? '#7f1d1d' : toast.type === 'warn' ? '#78350f' : '#064e3b'
  const border  = toast.type === 'err' ? '#dc262650' : toast.type === 'warn' ? '#d9770650' : '#05966950'
  const color   = toast.type === 'err' ? '#fca5a5' : toast.type === 'warn' ? '#fcd34d' : '#6ee7b7'

  return (
    <div style={{
      position: 'fixed', top: 14, right: 14, zIndex: 9999,
      maxWidth: 420, background: bg,
      border: `1px solid ${border}`,
      color,
      padding: '10px 16px',
      borderRadius: 10,
      fontWeight: 600,
      fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,.6)',
      lineHeight: 1.5,
      animation: 'fade-in 0.2s ease',
    }}>
      {toast.msg}
    </div>
  )
}
