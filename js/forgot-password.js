
"use strict";

// =========================================================
// ILABRAT STUDENTS - PASSWORD RECOVERY
// Forgot Password Logic
// =========================================================

const recoveryForm = document.getElementById("recoveryForm");
const recoveryEmail = document.getElementById("recoveryEmail");
const recoveryButton = document.getElementById("recoveryButton");
const recoveryMessage = document.getElementById("recoveryMessage");

function showRecoveryMessage(message, type = "") {
    recoveryMessage.textContent = message;
    recoveryMessage.className = "recovery-message";

    if (type) {
        recoveryMessage.classList.add(type);
    }
}

recoveryForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = recoveryEmail.value.trim();

    if (!email) {
        showRecoveryMessage(
            "يرجى إدخال البريد الإلكتروني.",
            "error"
        );
        return;
    }

    const client = window.supabaseClient;

    if (!client) {
        showRecoveryMessage(
            "تعذر الاتصال بالخدمة. تحقق من الإنترنت وإعدادات المشروع.",
            "error"
        );
        return;
    }

    recoveryButton.disabled = true;
    recoveryButton.textContent = "جارٍ إرسال الطلب...";

    showRecoveryMessage("");

    try {
        const redirectUrl = new URL(
            "reset-password.html",
            window.location.href
        ).href;

        const { error } = await client.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: redirectUrl
            }
        );

        if (error) {
            console.error("Password recovery error:", error);

            showRecoveryMessage(
                "تعذر إرسال طلب الاستعادة. تحقق من إعدادات البريد الإلكتروني في Supabase وحاول مجدداً.",
                "error"
            );

            return;
        }

        showRecoveryMessage(
            "إذا كان بالإمكان استعادة الحساب بهذا البريد، فستصلك رسالة تتضمن تعليمات الاستعادة. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.",
            "success"
        );

    } catch (error) {
        console.error("Password recovery error:", error);

        showRecoveryMessage(
            "تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجدداً.",
            "error"
        );

    } finally {
        recoveryButton.disabled = false;
        recoveryButton.textContent = "إرسال رابط الاستعادة";
    }
});
