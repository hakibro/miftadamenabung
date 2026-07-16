import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProfile } from "../services/profileService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [session, setSession] = useState(null);
	const [profile, setProfile] = useState(null);
	const [profileError, setProfileError] = useState("");
	const [loading, setLoading] = useState(true);

	async function loadProfile(userId) {
		if (!userId) {
			setProfile(null);
			setProfileError("");
			return null;
		}
		try {
			const data = await getProfile(userId);
			setProfile(data);
			setProfileError(
				data
					? ""
					: "Profil user belum ada. Hubungi admin atau jalankan seed/admin profile.",
			);
			return data;
		} catch (error) {
			setProfile(null);
			setProfileError(error.message || "Gagal memuat profil user.");
			return null;
		}
	}

	useEffect(() => {
		let mounted = true;

		supabase.auth.getSession().then(async ({ data }) => {
			if (!mounted) return;
			setSession(data.session);
			await loadProfile(data.session?.user?.id);
			setLoading(false);
		});

		const { data: listener } = supabase.auth.onAuthStateChange(
			(_event, nextSession) => {
				setSession(nextSession);
				setLoading(false);

				// Supabase recommends avoiding async Supabase calls directly inside
				// onAuthStateChange callbacks. Schedule profile loading after auth settles.
				setTimeout(() => {
					loadProfile(nextSession?.user?.id);
				}, 0);
			},
		);

		return () => {
			mounted = false;
			listener.subscription.unsubscribe();
		};
	}, []);

	async function signIn(email, password) {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) throw error;
	}

	async function signInWithUsername(identifier, password) {
		let email = identifier;
		if (!identifier.includes("@")) {
			const { data, error } = await supabase.rpc("resolve_username", {
				username_input: identifier,
			});
			if (error) throw new Error("Gagal mencari username");
			if (!data || data.length === 0)
				throw new Error("Username tidak ditemukan");
			email = data[0].email;
		}
		return signIn(email, password);
	}

	async function signOut() {
		await supabase.auth.signOut();
		setSession(null);
		setProfile(null);
		setProfileError("");
	}

	const value = useMemo(
		() => ({
			session,
			user: session?.user ?? null,
			profile,
			profileError,
			loading,
			signIn,
			signInWithUsername,
			signOut,
			refreshProfile: () => loadProfile(session?.user?.id),
		}),
		[session, profile, profileError, loading],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used inside AuthProvider");
	return context;
}
