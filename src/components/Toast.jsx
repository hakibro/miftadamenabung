export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  const styles = type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-soft ${styles}`}>
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button className="font-semibold" onClick={onClose}>Tutup</button>
      </div>
    </div>
  );
}
