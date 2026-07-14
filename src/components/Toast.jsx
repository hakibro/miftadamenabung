import { useState, useEffect } from "react";

const icons = {
	success: "✓",
	error: "✕",
	info: "ℹ",
};

const bgStyles = {
	success: "bg-emerald-600",
	error: "bg-red-600",
	info: "bg-blue-600",
};

export default function Toast({ message, type = "success", onClose }) {
	if (!message) return null;

	const [show, setShow] = useState(false);

	useEffect(() => {
		requestAnimationFrame(() => setShow(true));
		const timer = setTimeout(onClose, 4000);
		return () => clearTimeout(timer);
	}, [message, onClose]);

	return (
		<div
			className={`fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto flex max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg transition-all duration-300 sm:left-1/2 sm:-translate-x-1/2 ${bgStyles[type]} ${
				show ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
			}`}>
			<span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
				{icons[type]}
			</span>
			<span className="min-w-0 flex-1 break-words">{message}</span>
			<button
				className="shrink-0 text-white/70 hover:text-white"
				onClick={onClose}>
				✕
			</button>
		</div>
	);
}
