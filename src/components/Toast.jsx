export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  const styles = type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div className={`fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 rounded-lg border px-4 py-3 text-sm shadow-soft sm:left-auto sm:max-w-sm ${styles}`}>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 break-words">{message}</span>
        <button className="shrink-0 font-semibold" onClick={onClose}>Tutup</button>
      </div>
    </div>
  );
}
