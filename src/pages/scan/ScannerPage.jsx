import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera } from "lucide-react";

function parseStudentId(text) {
	const match = text.match(/\/scan\/siswa\/([a-f0-9-]+)/i);
	if (match) return match[1];
	const trimmed = text.trim();
	if (/^[a-f0-9-]{36}$/i.test(trimmed)) return trimmed;
	return null;
}

export default function ScannerPage() {
	const navigate = useNavigate();
	const scannerRef = useRef(null);
	const [status, setStatus] = useState("starting"); // starting | running | error
	const [errorMsg, setErrorMsg] = useState("");

	useEffect(() => {
		let stopped = false;

		async function startScanner() {
			try {
				// Small delay ensures DOM element is rendered
				await new Promise((r) => setTimeout(r, 200));

				if (stopped) return;

				const el = document.getElementById("qr-reader");
				if (!el) {
					setErrorMsg("Element scanner tidak ditemukan.");
					setStatus("error");
					return;
				}

				const scanner = new Html5Qrcode("qr-reader", {
					verbose: false,
					experimentalFeatures: {
						useBarCodeDetectorIfSupported: true,
					},
				});
				scannerRef.current = scanner;

				await scanner.start(
					{ facingMode: "environment" },
					{
						fps: 10,
						qrbox: { width: 250, height: 250 },
						aspectRatio: 1,
					},
					(decodedText) => {
						if (stopped) return;
						scanner.stop().catch(() => {});
						const id = parseStudentId(decodedText);
						if (id) {
							navigate(`/scan/siswa/${id}`, { replace: true });
						} else {
							setErrorMsg("QR code tidak dikenal. Pastikan QR siswa.");
							setStatus("error");
						}
					},
					() => {
						// scan tick failed, silent
					},
				);

				if (!stopped) setStatus("running");
			} catch (err) {
				if (!stopped) {
					console.error("Scanner error:", err);
					setErrorMsg(
						err.message || "Gagal mengakses kamera. Izinkan akses kamera.",
					);
					setStatus("error");
				}
			}
		}

		startScanner();

		return () => {
			stopped = true;
			if (scannerRef.current) {
				scannerRef.current.stop().catch(() => {});
			}
		};
	}, [navigate]);

	function handleRetry() {
		setStatus("starting");
		setErrorMsg("");
		// Remount by toggling a key — simpler: reload
		window.location.reload();
	}

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

			{status === "error" ? (
				<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
					<p>{errorMsg}</p>
					<button
						type="button"
						onClick={handleRetry}
						className="mt-2 font-medium text-red-800 underline">
						Coba lagi
					</button>
				</div>
			) : null}

			<div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
				{status === "starting" ? (
					<div className="flex flex-col items-center gap-3 p-8 text-slate-400">
						<Camera className="h-10 w-10 animate-pulse" />
						<p className="text-sm">Membuka kamera...</p>
					</div>
				) : null}
				{/* Always render the scanner container so Html5Qrcode finds it */}
				<div
					id="qr-reader"
					style={{ display: status === "running" ? "block" : "none" }}
				/>
			</div>

			<p className="text-center text-xs text-slate-400">
				Arahkan kamera ke QR code siswa
			</p>
		</div>
	);
}
