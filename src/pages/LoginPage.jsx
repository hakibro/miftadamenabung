import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { WalletCards } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { roleHome } from "../utils/roles";

export default function LoginPage() {
	const { signInWithUsername, signOut, user, profile, profileError, loading } =
		useAuth();
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const from = location.state?.from?.pathname;

	useEffect(() => {
		if (user && profile)
			navigate(from || roleHome(profile.role), { replace: true });
	}, [user, profile, from, navigate]);

	if (!loading && user && profile)
		return <Navigate to={from || roleHome(profile.role)} replace />;

	async function handleSubmit(event) {
		event.preventDefault();
		setError("");
		setSubmitting(true);
		try {
			await signInWithUsername(identifier, password);
			setSubmitting(false);
		} catch (err) {
			setError(err.message || "Login gagal");
			setSubmitting(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
			<div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
				<div className="mb-6 flex items-center gap-3">
					<div className="rounded-lg bg-brand-50 p-3 text-brand-700">
						<WalletCards size={28} />
					</div>
					<div>
						<h1 className="text-xl font-semibold text-slate-900">
							Sistem Keuangan Kelas
						</h1>
						<p className="text-sm text-slate-500">Masuk untuk melanjutkan</p>
					</div>
				</div>

				{!import.meta.env.VITE_SUPABASE_URL ? (
					<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
						Supabase belum dikonfigurasi. Buat `.env.local` dari `.env.example`.
					</div>
				) : null}

				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="block">
						<span className="mb-1 block text-sm font-medium text-slate-700">
							Email / Username
						</span>
						<input
							type="text"
							className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
							value={identifier}
							onChange={(event) => setIdentifier(event.target.value)}
							required
						/>
					</label>
					<label className="block">
						<span className="mb-1 block text-sm font-medium text-slate-700">
							Password
						</span>
						<input
							type="password"
							className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</label>
					{error ? (
						<p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
							{error}
						</p>
					) : null}
					{user && !profile && profileError ? (
						<div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
							<p>{profileError}</p>
							<button
								type="button"
								className="mt-2 font-semibold text-amber-900"
								onClick={signOut}>
								Keluar dan coba lagi
							</button>
						</div>
					) : null}
					<button
						type="submit"
						disabled={submitting}
						className="w-full rounded-md bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
						{submitting ? "Memproses..." : "Masuk"}
					</button>
				</form>
			</div>
		</div>
	);
}
