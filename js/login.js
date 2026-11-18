
"use strict";

// =========================================================
// ILABRAT STUDENTS - LOGIN
// تسجيل دخول الطلاب والمعلمين والإدارة
// =========================================================

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");

const buttonLabel = loginButton
    ? loginButton.querySelector(".button-label")
    : null;

const loginMessage = document.getElementById("loginMessage");
const togglePassword = document.getElementById("togglePassword");

const selectedAccount = document.getElementById("selectedAccount");
const selectedAccountName = document.getElementById("selectedAccountName");
const currentYear = document.getElementById("currentYear");

// =========================================================
// أنواع الحسابات
// =========================================================

const accountTypes = {
    student: {
        label: "الطالب",
        roles: ["student"],
        destination: "timetable.html"
    },

    teacher: {
        label: "المعلم",
        roles: ["teacher"],
        destination: "teacher.html"
    },

    school_admin: {
        label: "مدير المدرسة",
        roles: ["school_admin"],
        destination: "admin-timetable.html"
    },

    admin: {
        label: "مدير التطبيق",
        roles: ["admin"],
        destination: "main-admin.html"
    }
};

const urlParams = new URLSearchParams(window.location.search);
const requestedRole = urlParams.get("role");
const requestedAccount = accountTypes[requestedRole] || null;

// =========================================================
// إنشاء حقول دخول المعلم
// =========================================================

let teacherFields = null;

function createTeacherFields() {
    if (!loginForm || teacherFields) return;

    teacherFields = document.createElement("div");
    teacherFields.id = "teacherLoginFields";

    teacherFields.innerHTML = `
        <div class="form-group">
            <label for="teacherFullName">الاسم الرباعي</label>
            <input
                id="teacherFullName"
                name="teacherFullName"
                type="text"
                autocomplete="name"
                placeholder="أدخل اسمك الرباعي"
                required>
        </div>

        <div class="form-group">
            <label for="teacherSchoolName">اسم المدرسة</label>
            <input
                id="teacherSchoolName"
                name="teacherSchoolName"
                type="text"
                autocomplete="organization"
                placeholder="أدخل اسم المدرسة"
                required>
        </div>

        <div class="form-group">
            <label for="teacherLoginCode">كود الدخول</label>
            <div class="password-field">
                <input
                    id="teacherLoginCode"
                    name="teacherLoginCode"
                    type="password"
                    autocomplete="current-password"
                    placeholder="أدخل كود الدخول"
                    required>
                <button
                    id="toggleTeacherCode"
                    class="password-toggle"
                    type="button"
                    aria-label="إظهار كود الدخول"
                    aria-pressed="false">
                    إظهار
                </button>
            </div>
        </div>
    `;

    const emailGroup = emailInput?.closest(".form-group");
    const passwordGroup = passwordInput?.closest(".form-group");

    if (emailGroup && passwordGroup) {
        emailGroup.hidden = true;
        passwordGroup.hidden = true;

        emailInput.required = false;
        passwordInput.required = false;

        loginForm.insertBefore(teacherFields, emailGroup);
    } else {
        loginForm.prepend(teacherFields);
    }

    const teacherCodeInput =
        teacherFields.querySelector("#teacherLoginCode");

    const toggleTeacherCode =
        teacherFields.querySelector("#toggleTeacherCode");

    if (toggleTeacherCode && teacherCodeInput) {
        toggleTeacherCode.addEventListener("click", () => {
            const isHidden = teacherCodeInput.type === "password";

            teacherCodeInput.type = isHidden ? "text" : "password";
            toggleTeacherCode.textContent = isHidden ? "إخفاء" : "إظهار";

            toggleTeacherCode.setAttribute(
                "aria-label",
                isHidden ? "إخفاء كود الدخول" : "إظهار كود الدخول"
            );

            toggleTeacherCode.setAttribute(
                "aria-pressed",
                String(isHidden)
            );
        });
    }

    const headerParagraph = document.querySelector(".login-header p");

    if (headerParagraph) {
        headerParagraph.textContent =
            "أدخل اسمك الرباعي واسم المدرسة وكود الدخول للمتابعة.";
    }

    const forgotPassword = document.querySelector(
        ".forgot-password-wrapper"
    );

    if (forgotPassword) {
        forgotPassword.hidden = true;
    }

    const securityNote = document.querySelector(".security-note");

    if (securityNote) {
        securityNote.innerHTML =
            "<span aria-hidden='true'>●</span> " +
            "بيانات حسابك محمية وتظهر لك المعلومات المسموح بها حسب صلاحياتك.";
    }
}

// =========================================================
// تهيئة الصفحة
// =========================================================

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

if (requestedAccount && selectedAccount && selectedAccountName) {
    selectedAccountName.textContent = requestedAccount.label;
    selectedAccount.hidden = false;

    document.title =
        "تسجيل دخول " +
        requestedAccount.label +
        " | جداول إيلابرات";
}

if (requestedRole === "teacher") {
    createTeacherFields();
} else if (emailInput) {
    emailInput.type = "text";
    emailInput.autocomplete = "username";

    if (requestedRole === "student") {
        emailInput.placeholder = "اسم المستخدم";
        emailInput.setAttribute("aria-label", "اسم المستخدم");
    } else {
        emailInput.placeholder = "البريد الإلكتروني";
        emailInput.setAttribute(
            "aria-label",
            "البريد الإلكتروني"
        );
    }
}

// =========================================================
// رسائل الحالة
// =========================================================

function showMessage(message, type = "error") {
    if (!loginMessage) {
        console.error(message);
        return;
    }

    loginMessage.textContent = message;
    loginMessage.className = "login-message";

    if (type) {
        loginMessage.classList.add(type);
    }

    loginMessage.hidden = false;
}

function clearMessage() {
    if (!loginMessage) return;

    loginMessage.textContent = "";
    loginMessage.className = "login-message";
    loginMessage.hidden = true;
}

// =========================================================
// إظهار وإخفاء كلمة المرور العادية
// =========================================================

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";

        passwordInput.type = isPassword ? "text" : "password";
        togglePassword.textContent = isPassword ? "إخفاء" : "إظهار";

        togglePassword.setAttribute(
            "aria-label",
            isPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
        );

        togglePassword.setAttribute(
            "aria-pressed",
            String(isPassword)
        );
    });
}

// =========================================================
// تحديد نوع الحساب وفق الدور الفعلي
// =========================================================

function getAccountType(role) {
    for (const [key, account] of Object.entries(accountTypes)) {
        if (account.roles.includes(role)) {
            return { key, ...account };
        }
    }

    return null;
}

// =========================================================
// حالة زر تسجيل الدخول
// =========================================================

function setLoading(isLoading) {
    if (!loginButton) return;

    loginButton.disabled = isLoading;

    if (buttonLabel) {
        buttonLabel.textContent = isLoading
            ? "جارٍ التحقق..."
            : "تسجيل الدخول";
    }
}

// =========================================================
// تسجيل دخول الطالب عبر student-login-handler
// =========================================================

async function loginStudent(client) {
    const username = emailInput.value.trim();
    const secretCode = passwordInput.value;

    if (!username || !secretCode) {
        showMessage("يرجى إدخال اسم المستخدم والرمز السري.");
        return;
    }

    const { data, error } = await client.functions.invoke(
        "student-login-handler",
        {
            body: {
                username,
                secret_code: secretCode
            }
        }
    );

    if (error) {
        console.error("Student login handler error:", error);

        let message = "تعذر تسجيل الدخول. تحقق من اسم المستخدم والرمز السري.";

        if (error.context && typeof error.context.json === "function") {
            try {
                const responseBody = await error.context.json();

                if (responseBody?.error) {
                    message = responseBody.error;
                }
            } catch {
                // الإبقاء على رسالة الخطأ العامة.
            }
        }

        showMessage(message);
        return;
    }

    if (
        !data ||
        data.success !== true ||
        !data.access_token ||
        !data.refresh_token
    ) {
        console.error("Invalid student login response:", data);

        showMessage(
            data?.error ||
            "لم تكتمل عملية تسجيل الدخول. حاول مجددًا."
        );
        return;
    }

    // حفظ جلسة الطالب في Supabase.
    const { data: sessionData, error: sessionError } =
        await client.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });

    if (sessionError || !sessionData?.user) {
        console.error("Student session error:", sessionError);

        showMessage(
            "تم التحقق من بياناتك، لكن تعذر إنشاء جلسة الدخول."
        );
        return;
    }

    // التحقق من دور الحساب بعد إنشاء الجلسة.
    const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role")
        .eq("id", sessionData.user.id)
        .maybeSingle();

    if (profileError || !profile || profile.role !== "student") {
        console.error("Student role verification failed:", profileError);

        await client.auth.signOut();

        showMessage("تعذر التحقق من صلاحيات حساب الطالب.");
        return;
    }

    showMessage(
        "تم تسجيل الدخول بنجاح. جارٍ فتح حسابك...",
        "success"
    );

    window.location.replace("timetable.html");
}

// =========================================================
// تسجيل دخول المعلم عبر teacher-handler
// =========================================================

async function loginTeacher(client) {
    const fullName = document
        .getElementById("teacherFullName")
        ?.value.trim();

    const schoolName = document
        .getElementById("teacherSchoolName")
        ?.value.trim();

    const code = document
        .getElementById("teacherLoginCode")
        ?.value.trim();

    if (!fullName || !schoolName || !code) {
        showMessage("يرجى إدخال الاسم الرباعي واسم المدرسة وكود الدخول.");
        return;
    }

    if (fullName.split(/\s+/).filter(Boolean).length < 4) {
        showMessage("يرجى كتابة الاسم الرباعي كاملًا.");
        return;
    }

    const { data, error } = await client.functions.invoke(
        "teacher-handler",
        {
            body: {
                action: "login",
                full_name: fullName,
                school_name: schoolName,
                code
            }
        }
    );

    if (error) {
        console.error("Teacher handler error:", error);

        let message = "تعذر تسجيل الدخول. تحقق من بياناتك وحاول مجددًا.";

        if (error.context && typeof error.context.json === "function") {
            try {
                const responseBody = await error.context.json();

                if (responseBody?.error) {
                    message = responseBody.error;
                }
            } catch {
                // إبقاء رسالة الخطأ العامة.
            }
        }

        showMessage(message);
        return;
    }

    if (
        !data ||
        data.success !== true ||
        !data.token_hash ||
        !data.email
    ) {
        console.error("Invalid teacher login response:", data);

        showMessage(
            data?.error ||
            "لم تكتمل عملية تسجيل الدخول. تحقق من إعدادات الدالة."
        );
        return;
    }

    const { data: sessionData, error: sessionError } =
        await client.auth.verifyOtp({
            token_hash: data.token_hash,
            type: "magiclink"
        });

    if (sessionError || !sessionData?.session || !sessionData?.user) {
        console.error("Teacher session verification failed:", sessionError);

        showMessage(
            "تم التحقق من بياناتك، لكن تعذر إنشاء جلسة الدخول. " +
            "تحقق من إعدادات Supabase ثم حاول مجددًا."
        );
        return;
    }

    const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role")
        .eq("id", sessionData.user.id)
        .maybeSingle();

    if (profileError || !profile || profile.role !== "teacher") {
        console.error("Teacher role verification failed:", profileError);

        await client.auth.signOut();

        showMessage("تعذر التحقق من صلاحيات حساب المعلم.");
        return;
    }

    showMessage("تم تسجيل الدخول بنجاح. جارٍ فتح حسابك...", "success");

    window.location.replace("teacher.html");
}

// =========================================================
// تسجيل دخول مدير المدرسة ومدير التطبيق
// =========================================================

async function loginStandardAccount(client) {
    const enteredIdentifier = emailInput.value.trim();
    const password = passwordInput.value;

    if (!enteredIdentifier || !password) {
        showMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
        return;
    }

    const { data, error } = await client.auth.signInWithPassword({
        email: enteredIdentifier,
        password
    });

    if (error) {
        console.error("Supabase sign-in error:", error);

        showMessage(
            "تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور."
        );
        return;
    }

    if (!data?.user) {
        showMessage("تعذر التحقق من الحساب. حاول مرة أخرى.");
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
        console.error("Profile lookup error:", profileError);

        await client.auth.signOut();

        showMessage("تعذر التحقق من صلاحيات الحساب. حاول لاحقًا.");
        return;
    }

    if (!profile?.role) {
        await client.auth.signOut();

        showMessage(
            "لم يُعثر على صلاحيات لهذا الحساب. راجع إدارة التطبيق."
        );
        return;
    }

    const actualAccount = getAccountType(profile.role);

    if (!actualAccount) {
        await client.auth.signOut();

        showMessage("نوع الحساب غير معروف. راجع مدير التطبيق.");
        return;
    }

    if (
        requestedAccount &&
        !requestedAccount.roles.includes(profile.role)
    ) {
        await client.auth.signOut();

        showMessage(
            "هذا الحساب ليس من فئة " +
            requestedAccount.label +
            ". اختر نوع الحساب الصحيح."
        );
        return;
    }

    showMessage("تم تسجيل الدخول بنجاح. جارٍ فتح حسابك...", "success");

    window.location.replace(actualAccount.destination);
}

// =========================================================
// نموذج تسجيل الدخول
// =========================================================

if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        clearMessage();

        const client = window.supabaseClients[requestedRole];

        if (!client) {
            console.error(
                "Supabase client is missing. تحقق من تحميل supabase-config.js."
            );

            showMessage("تعذر الاتصال بالخدمة. تحقق من إعدادات الاتصال.");
            return;
        }

        setLoading(true);

        try {
            if (requestedRole === "student") {
                await loginStudent(client);
            } else if (requestedRole === "teacher") {
                await loginTeacher(client);
            } else {
                await loginStandardAccount(client);
            }
        } catch (error) {
            console.error("Unexpected login error:", error);

            showMessage(
                "حدث خطأ أثناء تسجيل الدخول. حاول مجددًا."
            );
        } finally {
            setLoading(false);
        }
    });
}
