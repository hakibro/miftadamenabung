import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Scan } from "lucide-react";
import TransactionTabs from "../../components/TransactionTabs";
import { useAuth } from "../../contexts/AuthContext";
import { listStudents } from "../../services/masterDataService";

export default function InputPage() {
	const { profile } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const preselectedStudentId = searchParams.get("student") || "";
	const [students, setStudents] = useState([]);
	const [selected, setSelected] = useState(preselectedStudentId);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!profile?.assigned_class_id) {
			setStudents([]);
			setSelected("");
			return;
		}

		setLoading(true);
		setError("");
		listStudents({ mineAsWalas: true })
			.then((rows) => {
				setStudents(rows);
				setSelected((current) => current || rows[0]?.id || "");
			})
			.catch((err) => setError(err.message || "Gagal memuat siswa"))
			.finally(() => setLoading(false));
	}, [profile?.assigned_class_id]);

	const student = students.find((item) => item.id === selected);

	return (
		<div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
			<div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
				{!profile?.assigned_class_id ? (
					<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
						Akun wali kelas ini belum dipasangkan ke kelas. Admin perlu membuka
						menu User lalu memilih kelas untuk akun walas ini.
					</div>
				) : null}
				{error ? (
					<div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
				) : null}
				<label className="block">
					<span className="mb-1 block text-xs font-medium text-slate-500 sm:text-sm">
						Pilih siswa
					</span>
					<div className="flex gap-2">
						<select
							className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm sm:rounded-md sm:py-2"
							value={selected}
							onChange={(e) => setSelected(e.target.value)}
							disabled={!students.length}>
							<option value="">
								{loading ? "Memuat siswa..." : "Pilih siswa"}
							</option>
							{students.map((item, idx) => (
								<option key={item.id} value={item.id}>
									{idx + 1}. {item.name}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={() => navigate("/scan/siswa/scan")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100 active:bg-brand-200 sm:rounded-md sm:py-2"
							title="Scan barcode siswa">
							<Scan className="h-4 w-4" />
							<span className="hidden sm:inline">Scan</span>
						</button>
					</div>
				</label>
			</div>
			{student ? (
				<TransactionTabs student={student} />
			) : (
				<p className="text-sm text-slate-500">
					{loading
						? "Memuat daftar siswa..."
						: "Belum ada siswa aktif di kelas ini."}
				</p>
			)}
		</div>
	);
}
