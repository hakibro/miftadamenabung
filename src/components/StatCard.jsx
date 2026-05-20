export default function StatCard({ title, value, helper, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-[22px] border border-white/80 bg-white p-4 shadow-sm sm:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 break-words text-xl font-bold tracking-normal text-slate-950 sm:text-2xl">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-2xl bg-brand-50 p-2.5 text-brand-700">
            <Icon size={20} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
