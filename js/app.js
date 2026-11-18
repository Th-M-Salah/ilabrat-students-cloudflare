"use strict";

/* ILABRAT Students — Login page only.
   Keep supabase-config.js unchanged; it must create window.supabaseClient. */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("passwordToggle");
  const message = document.getElementById("loginMessage");
  const year = document.getElementById("currentYear");
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;

  if (year) year.textContent = new Date().getFullYear();

  function showMessage(text, type = "error") {
    if (!message) return;
    message.textContent = text;
    message.className = `login-message ${type}`;
    message.hidden = false;
  }

  function setLoading(isLoading) {
    if (submitButton) {
      submitButton.disabled = isLoading;
      const label = submitButton.querySelector(".button-label");
      if (label) label.textContent = isLoading ? "جارٍ التحقق..." : "دخول إلى الحساب";
    }
    if (emailInput) emailInput.disabled = isLoading;
    if (passwordInput) passwordInput.disabled = isLoading;
    if (passwordToggle) passwordToggle.disabled = isLoading;
  }

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", () => {
      const reveal = passwordInput.type === "password";
      passwordInput.type = reveal ? "text" : "password";
      passwordToggle.textContent = reveal ? "إخفاء" : "إظهار";
      passwordToggle.setAttribute("aria-label", reveal ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      passwordToggle.setAttribute("aria-pressed", String(reveal));
    });
  }

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (message) message.hidden = true;

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
      showMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      showMessage("تعذر الاتصال بخدمة تسجيل الدخول. تحقق من إعدادات Supabase.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data || !data.user) throw new Error("لم يتم العثور على بيانات المستخدم بعد تسجيل الدخول.");

      // The home page verifies the profile and displays only role-appropriate links.
      window.location.replace("index.html");
    } catch (error) {
      console.error("ILABRAT login error:", error);
      const rawMessage = (error && error.message) ? error.message : "حدث خطأ غير متوقع.";
      const friendlyMessage = /invalid login credentials/i.test(rawMessage)
        ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        : /email not confirmed/i.test(rawMessage)
          ? "يرجى تأكيد البريد الإلكتروني أولًا."
          : "تعذر تسجيل الدخول. تحقق من البيانات ثم حاول مرة أخرى.";
      showMessage(friendlyMessage);
      setLoading(false);
    }
  });
});
