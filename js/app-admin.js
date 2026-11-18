
"use strict";

/* =========================================================
   ILABRAT Students — App Admin Login
   تسجيل دخول مدير التطبيق فقط.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("appAdminLoginForm");
    const emailInput = document.getElementById("adminEmail");
    const passwordInput = document.getElementById("adminPassword");
    const loginButton = document.getElementById("adminLoginButton");
    const message = document.getElementById("adminLoginMessage");
    const togglePassword = document.getElementById("toggleAdminPassword");
    const year = document.getElementById("currentYear");

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    function showMessage(text, type = "error") {
        if (!message) return;

        message.textContent = text;
        message.className = "login-message " + type;
        message.hidden = false;
    }

    function setLoading(loading) {
        if (!loginButton) return;

        loginButton.disabled = loading;
        loginButton.textContent = loading
            ? "جارٍ التحقق..."
            : "تسجيل الدخول";
    }

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", () => {
            const showing = passwordInput.type === "password";

            passwordInput.type = showing ? "text" : "password";
            togglePassword.textContent = showing ? "إخفاء" : "إظهار";

            togglePassword.setAttribute(
                "aria-pressed",
                String(showing)
            );

            togglePassword.setAttribute(
                "aria-label",
                showing ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
            );
        });
    }

    if (!form) {
        console.error("App admin login form was not found.");
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (message) {
            message.hidden = true;
        }

        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";
        const client = window.supabaseClient;

        if (!email || !password) {
            showMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
            return;
        }

        if (!client || !client.auth) {
            console.error("Supabase client is unavailable.");

            showMessage(
                "تعذر الاتصال بالخدمة. تحقق من إعدادات Supabase."
            );
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error || !data?.user) {
                console.error("Admin sign-in failed:", error);

                showMessage(
                    "تعذر تسجيل الدخول. تحقق من بيانات الحساب."
                );
                return;
            }

            const {
                data: profile,
                error: profileError
            } = await client
                .from("profiles")
                .select("role")
                .eq("id", data.user.id)
                .maybeSingle();

            if (profileError) {
                console.error(
                    "Admin profile lookup failed:",
                    profileError
                );

                await client.auth.signOut();

                showMessage(
                    "تعذر التحقق من صلاحيات الحساب. حاول لاحقًا."
                );
                return;
            }

            if (!profile || profile.role !== "admin") {
                await client.auth.signOut();

                showMessage(
                    "هذا الحساب لا يملك صلاحية مدير التطبيق."
                );
                return;
            }

            showMessage(
                "تم التحقق بنجاح. جارٍ فتح لوحة الإدارة...",
                "success"
            );

            window.location.replace("main-admin.html");

        } catch (error) {
            console.error("Unexpected admin login error:", error);

            try {
                await client.auth.signOut();
            } catch (signOutError) {
                console.error("Sign-out failed:", signOutError);
            }

            showMessage(
                "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى."
            );

        } finally {
            setLoading(false);
        }
    });
});
