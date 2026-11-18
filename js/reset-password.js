
"use strict";

// =========================================================
// ILABRAT STUDENTS - RESET PASSWORD
// Password Reset Logic
// =========================================================

const resetPasswordForm = document.getElementById("resetPasswordForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const resetPasswordButton = document.getElementById("resetPasswordButton");
const resetPasswordMessage = document.getElementById("resetPasswordMessage");

let recoverySessionReady = false;
let resetInProgress = false;

function showResetMessage(message, type = "") {
    resetPasswordMessage.textContent = message;
    resetPasswordMessage.className = "reset-message";

    if (type) {
        resetPasswordMessage.classList.add(type);
    }
}

// إظهار وإخفاء كلمات المرور

document.querySelectorAll(".password-toggle").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);

        if (!input) {
            return;
        }

        const shouldShow = input.type === "password";

        input.type = shouldShow ? "text" : "password";
        button.textContent = shouldShow ? "إخفاء" : "إظهار";

        button.setAttribute(
            "aria-label",
            shouldShow ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
        );
    });
});

// تجهيز جلسة الاستعادة القادمة من رابط البريد

async function prepareRecoverySession() {
    const client = window.supabaseClient;

    if (!client) {
        showResetMessage(
            "تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم أعد تحميل الصفحة.",
            "error"
        );

        resetPasswordButton.disabled = true;
        return;
    }

    try {
        // إذا وصل المستخدم برابط يحتوي على رمز الاستعادة،
        // تحاول مكتبة Supabase إنشاء جلسة الاستعادة.
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(
            url.hash.replace(/^#/, "")
        );

        const recoveryError = hashParams.get("error_description");

        if (recoveryError) {
            showResetMessage(
                "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.",
                "error"
            );

            return;
        }

        if (hashParams.get("type") === "recovery" && hashParams.get("access_token")) {
            const { error } = await client.auth.setSession({
                access_token: hashParams.get("access_token"),
                refresh_token: hashParams.get("refresh_token") || ""
            });

            if (error) {
                showResetMessage(
                    "تعذر التحقق من رابط الاستعادة. اطلب رابطاً جديداً.",
                    "error"
                );

                return;
            }
        }

        const { data, error } = await client.auth.getSession();

        if (error || !data.session) {
            showResetMessage(
                "افتح صفحة تغيير كلمة المرور من رابط الاستعادة الذي وصلك بالبريد الإلكتروني. إذا انتهت صلاحية الرابط، اطلب رابطاً جديداً.",
                "error"
            );

            return;
        }

        recoverySessionReady = true;
        showResetMessage(
            "يمكنك الآن تعيين كلمة المرور الجديدة.",
            "success"
        );

    } catch (error) {
        console.error("Recovery session error:", error);

        showResetMessage(
            "تعذر التحقق من جلسة الاستعادة. اطلب رابطاً جديداً وحاول مرة أخرى.",
            "error"
        );
    }
}

// حفظ كلمة المرور الجديدة

resetPasswordForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (resetInProgress) {
        return;
    }

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length < 8) {
        showResetMessage(
            "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
            "error"
        );

        return;
    }

    if (newPassword !== confirmPassword) {
        showResetMessage(
            "كلمتا المرور غير متطابقتين.",
            "error"
        );

        return;
    }

    if (!recoverySessionReady) {
        showResetMessage(
            "جلسة الاستعادة غير جاهزة. افتح رابط الاستعادة من بريدك الإلكتروني أو اطلب رابطاً جديداً.",
            "error"
        );

        return;
    }

    const client = window.supabaseClient;

    if (!client) {
        showResetMessage(
            "تعذر الاتصال بالخدمة. حاول مرة أخرى.",
            "error"
        );

        return;
    }

    resetInProgress = true;
    resetPasswordButton.disabled = true;
    resetPasswordButton.textContent = "جارٍ حفظ كلمة المرور...";

    showResetMessage("");

    try {
        const { error } = await client.auth.updateUser({
            password: newPassword
        });

        if (error) {
            console.error("Password update error:", error);

            showResetMessage(
                "تعذر تحديث كلمة المرور. قد يكون رابط الاستعادة منتهي الصلاحية. اطلب رابطاً جديداً وحاول مرة أخرى.",
                "error"
            );

            return;
        }

        showResetMessage(
            "تم تغيير كلمة المرور بنجاح. سيتم إنهاء جلسة الاستعادة وإعادتك إلى صفحة تسجيل الدخول.",
            "success"
        );

        newPasswordInput.value = "";
        confirmPasswordInput.value = "";

        await client.auth.signOut();

        window.setTimeout(() => {
            window.location.replace("login.html");
        }, 1800);

    } catch (error) {
        console.error("Password reset error:", error);

        showResetMessage(
            "حدث خطأ أثناء تحديث كلمة المرور. حاول مرة أخرى.",
            "error"
        );

    } finally {
        resetInProgress = false;
        resetPasswordButton.disabled = false;
        resetPasswordButton.textContent = "حفظ كلمة المرور الجديدة";
    }
});

// الاستماع لتغيرات جلسة الاستعادة

if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (
            event === "PASSWORD_RECOVERY" ||
            (event === "SIGNED_IN" && session)
        ) {
            recoverySessionReady = true;

            showResetMessage(
                "تم التحقق من الجلسة. يمكنك تعيين كلمة المرور الجديدة.",
                "success"
            );
        }
    });
}

prepareRecoverySession();
