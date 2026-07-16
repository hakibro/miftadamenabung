import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const anonKey =
		Deno.env.get("SUPABASE_ANON_KEY") ||
		Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
	const serviceRoleKey =
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
		Deno.env.get("SUPABASE_SECRET_KEY");

	if (!supabaseUrl || !anonKey || !serviceRoleKey) {
		return jsonResponse(
			{
				error:
					"Supabase function env vars are not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.",
			},
			500,
		);
	}

	const authHeader = req.headers.get("Authorization") || "";
	const userClient = createClient(supabaseUrl, anonKey, {
		global: { headers: { Authorization: authHeader } },
	});
	const adminClient = createClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	const { data: authData, error: authError } = await userClient.auth.getUser();
	if (authError || !authData.user) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	const { data: callerProfile, error: callerError } = await adminClient
		.from("profiles")
		.select("role,is_active")
		.eq("id", authData.user.id)
		.maybeSingle();

	if (
		callerError ||
		callerProfile?.role !== "admin" ||
		callerProfile?.is_active !== true
	) {
		return jsonResponse({ error: "Only active admin can manage users" }, 403);
	}

	const body = await req.json().catch(() => ({}));
	const action = body.action;
	const payload = body.payload || {};

	try {
		if (action === "list") {
			const { data, error } = await adminClient
				.from("profiles")
				.select(
					"*, assigned_class:classes!profiles_assigned_class_id_fkey(id,name,period_id,period:periods(id,name,is_active))",
				)
				.order("full_name");

			if (!error) return jsonResponse({ profiles: data || [] });

			const { data: plainProfiles, error: plainError } = await adminClient
				.from("profiles")
				.select("*")
				.order("full_name");

			if (plainError) throw plainError;

			const classIds = [
				...new Set(
					(plainProfiles || [])
						.map((profile) => profile.assigned_class_id)
						.filter(Boolean),
				),
			];
			const { data: classRows, error: classError } = classIds.length
				? await adminClient
						.from("classes")
						.select("id,name,period_id,period:periods(id,name,is_active)")
						.in("id", classIds)
				: { data: [], error: null };

			if (classError) throw classError;

			const classById = new Map(
				(classRows || []).map((item) => [item.id, item]),
			);
			const profiles = (plainProfiles || []).map((profile) => ({
				...profile,
				assigned_class: profile.assigned_class_id
					? classById.get(profile.assigned_class_id) || null
					: null,
			}));

			return jsonResponse({ profiles });
		}

		if (action === "create") {
			if (
				!payload.email ||
				!payload.password ||
				!payload.full_name ||
				!payload.role
			) {
				return jsonResponse(
					{ error: "Nama, email, password, dan role wajib diisi" },
					400,
				);
			}

			const username = payload.username || payload.email.split("@")[0];

			const { data, error } = await adminClient.auth.admin.createUser({
				email: payload.email,
				password: payload.password,
				email_confirm: true,
				user_metadata: {
					full_name: payload.full_name,
					role: payload.role,
					username,
				},
			});

			if (error) throw error;

			const { error: profileError } = await adminClient
				.from("profiles")
				.upsert({
					id: data.user.id,
					full_name: payload.full_name,
					email: payload.email,
					username,
					role: payload.role,
					assigned_class_id: null,
					is_active: payload.is_active ?? true,
				});

			if (profileError) throw profileError;

			return jsonResponse({
				user: data.user,
				profile: {
					id: data.user.id,
					full_name: payload.full_name,
					email: payload.email,
					role: payload.role,
					assigned_class_id: null,
					is_active: payload.is_active ?? true,
				},
			});
		}

		if (action === "update") {
			if (!payload.id)
				return jsonResponse({ error: "ID user wajib diisi" }, 400);

			const authUpdate: Record<string, unknown> = {};
			if (payload.email) authUpdate.email = payload.email;
			if (payload.password) authUpdate.password = payload.password;
			if (payload.full_name || payload.role || payload.username) {
				authUpdate.user_metadata = {
					full_name: payload.full_name,
					role: payload.role,
					username: payload.username,
				};
			}

			if (Object.keys(authUpdate).length) {
				const { error } = await adminClient.auth.admin.updateUserById(
					payload.id,
					authUpdate,
				);
				if (error) throw error;
			}

			const profileUpdate: Record<string, unknown> = {
				full_name: payload.full_name,
				email: payload.email,
				username: payload.username,
				role: payload.role,
				is_active: payload.is_active ?? true,
			};

			if (payload.role !== "walas") {
				profileUpdate.assigned_class_id = null;
			} else if (
				Object.prototype.hasOwnProperty.call(payload, "assigned_class_id")
			) {
				profileUpdate.assigned_class_id = payload.assigned_class_id || null;
			}

			const { error: profileError } = await adminClient
				.from("profiles")
				.update(profileUpdate)
				.eq("id", payload.id);

			if (profileError) throw profileError;

			return jsonResponse({ ok: true });
		}

		if (action === "delete") {
			if (!payload.id)
				return jsonResponse({ error: "ID user wajib diisi" }, 400);
			if (payload.id === authData.user.id)
				return jsonResponse(
					{ error: "Admin tidak bisa menghapus akun sendiri" },
					400,
				);

			const { error } = await adminClient.auth.admin.deleteUser(payload.id);
			if (error) throw error;

			return jsonResponse({ ok: true });
		}

		if (action === "set-active") {
			if (!payload.id)
				return jsonResponse({ error: "ID user wajib diisi" }, 400);
			if (payload.id === authData.user.id && payload.is_active === false) {
				return jsonResponse(
					{ error: "Admin tidak bisa menonaktifkan akun sendiri" },
					400,
				);
			}

			const { error } = await adminClient
				.from("profiles")
				.update({ is_active: payload.is_active })
				.eq("id", payload.id);

			if (error) throw error;
			return jsonResponse({ ok: true });
		}

		return jsonResponse({ error: "Unknown action" }, 400);
	} catch (error) {
		return jsonResponse(
			{ error: error.message || "Failed to manage user" },
			400,
		);
	}
});
