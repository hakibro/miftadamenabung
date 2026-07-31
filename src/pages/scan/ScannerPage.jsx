import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera } from "lucide-react";

export default function ScannerPage() {
	const navigate = useNavigate();
	const scannerRef = useRef(null);
	const [error, setError] = useState("");
	const [scanning, setScanning] = useState(false);

	useEffect(() => {
		const scanner = new Html5Qrcode("qr-reader");
		scannerRef.current = scanner;

		scanner
			.start(
				{ facingMode: "environment" },
				{ fps: 10, qrbox: { width: 250, height: 250 } },
				(decodedText) => {
					// QR value format: full URL like http://localhost:5173/scan/siswa/<uuid>
					// Extract the student ID from the URL
					scanner.stop().catch(() => {});
					const match = decodedText.match(/\/scan\/siswa\/([a-f0-9-]+)/i);
					if (match) {
						navigate(`/scan/siswa/${match[1]}`, { replace: true });
					} else {
						// Try treating the entire text as a UUID
						const uuidPattern = /^[a-f0-9-]{36}$/i;
						if (uuidPattern.test(decodedText.trim())) {
							navigate(`/scan/siswa/${decodedText.trim()}`, { replace: true });
						} else {
							setError("QR code tidak valid. Pastikan QR adalah QR siswa.");
							setScanning(false);
						}
					}
				},
				() => {
					// scan failure — silent, camera keeps trying
				},
			)
			.then(() => setScanning(true))
			.catch((err) => {
				setError(
					err.message || "Gagal mengakses kamera. Pastikan kamera diizinkan.",
				);
			});

		return () => {
			scanner.stop().catch(() => {});
		};
	}, [navigate]);

	return (
		<div className="mx-auto max-w-lg space-y-4">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
					<ArrowLeft className="h-4 w-4" />
					Kembali
				</button>
				<h1 className="text-lg font-semibold text-slate-800">Scan QR Siswa</h1>
			</div>

			{error ? (
				<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
					<p>{error}</p>
					<button
						type="button"
						onClick={() => {
							setError("");
							window.location.reload();
						}}
						className="mt-2 text-red-800 underline">
						Coba lagi
					</button>
				</div>
			) : null}

			<div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
				{!scanning && !error ? (
					<div className="flex flex-col items-center gap-3 p-8 text-slate-400">
						<Camera className="h-10 w-10 animate-pulse" />
						<p className="text-sm">Membuka kamera...</p>
					</div>
				) : null}
				<div id="qr-reader" className={scanning ? "" : "hidden"} />
			</div>

			<p className="text-center text-xs text-slate-400">
				Arahkan kamera ke QR code siswa
			</p>
		</div>
	);
}
