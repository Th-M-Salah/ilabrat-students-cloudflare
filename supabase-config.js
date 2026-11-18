
"use strict";

const SUPABASE_URL =
    "https://ulhwvfnwnqjksipdobao.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_wDItufCgriZDGyOwn38TmA_w3XfGJ9Q";

if (!window.supabase) {
    console.error("Supabase SDK لم يتم تحميله.");
} else {
    const createScopedClient = (storageKey) =>
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    storageKey,
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

    window.supabaseClients = {
        student: createScopedClient("ilabrat_student_auth"),
        teacher: createScopedClient("ilabrat_teacher_auth"),
        school_admin: createScopedClient("ilabrat_school_admin_auth"),
        admin: createScopedClient("ilabrat_app_admin_auth")
    };

    const scope = document.documentElement.dataset.authScope;

    window.supabaseClient =
        window.supabaseClients[scope] || null;

    console.log("تم إنشاء جلسات ILABRAT المستقلة.");
}
