
"use strict";

// =========================================================
// ILABRAT STUDENTS — إدارة حسابات الطلاب
// يُحمّل في صفحة admin-timetable.html
// =========================================================

(() => {
    const db = window.supabaseClient;

    const $ = (id) => document.getElementById(id);

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function showMessage(message, isError = false) {
        const element = $("studentAccountMessage");
        if (!element) return;

        element.textContent = message;
        element.style.color = isError ? "#a32020" : "#356b43";
    }

    function addStudentPanel() {
        if ($("studentAccountsPanel")) return;

        const panel = document.createElement("section");
        panel.id = "studentAccountsPanel";
        panel.dir = "rtl";

        panel.style.cssText = [
            "max-width:1100px",
            "margin:28px auto",
            "padding:24px",
            "background:#fff",
            "border:1px solid #e5dcd3",
            "border-radius:16px",
            "box-shadow:0 5px 20px rgba(67,19,29,.06)",
            "color:#292323"
        ].join(";");

        panel.innerHTML = `
            <h2 style="margin:0 0 8px;color:#5A1825">
                إدارة حسابات الطلاب
            </h2>

            <p style="margin:0 0 20px;color:#6F6461;line-height:1.8">
                أنشئ حساب الطالب باستخدام اسمه الرباعي وحدد الصف والشعبة.
            </p>

            <form id="studentAccountForm"
                style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">

                <label style="display:grid;gap:7px">
                    <span>الاسم الرباعي للطالب</span>
                    <input
                        id="studentFullName"
                        type="text"
                        maxlength="120"
                        autocomplete="off"
                        placeholder="مثال: أحمد محمد علي حسن"
                        required
                        style="padding:12px;border:1px solid #d8cec5;border-radius:9px;font:inherit">
                </label>

                <label style="display:grid;gap:7px">
                    <span>الصف والشعبة</span>
                    <select
                        id="studentClassId"
                        required
                        style="padding:12px;border:1px solid #d8cec5;border-radius:9px;background:white;font:inherit">
                        <option value="">جارٍ تحميل الصفوف...</option>
                    </select>
                </label>

                <div style="display:flex;align-items:end">
                    <button
                        id="createStudentButton"
                        type="submit"
                        style="padding:12px 20px;border:0;border-radius:9px;background:#5A1825;color:white;font:inherit;cursor:pointer">
                        إنشاء حساب الطالب
                    </button>
                </div>
            </form>

            <p
                id="studentAccountMessage"
                role="status"
                aria-live="polite"
                style="margin:16px 0 0;line-height:1.8">
            </p>

            <div
                id="studentCredentials"
                hidden
                style="margin-top:18px;padding:18px;border:1px solid #C7A56A;border-radius:12px;background:#F3EEE7">

                <h3 style="margin:0 0 10px;color:#5A1825">
                    بيانات دخول الطالب
                </h3>

                <p>اسم الطالب: <strong id="credentialFullName"></strong></p>
                <p>اسم المستخدم: <strong id="credentialUsername" dir="ltr"></strong></p>
                <p>الرمز السري: <strong id="credentialSecret" dir="ltr"></strong></p>
                <p>الصف والشعبة: <strong id="credentialClass"></strong></p>

                <button
                    id="copyStudentCredentials"
                    type="button"
                    style="padding:10px 16px;border:0;border-radius:8px;background:#8B5E4A;color:white;font:inherit;cursor:pointer">
                    نسخ بيانات الدخول
                </button>

                <p style="margin-bottom:0;color:#6F6461;font-size:13px">
                    احفظ بيانات الدخول قبل مغادرة الصفحة.
                </p>
            </div>
        `;

        const main = document.querySelector("main");

        if (main) {
            main.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }
    }

    async function loadSchoolClasses(userId) {
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .maybeSingle();

        if (profileError) {
            throw new Error("تعذر التحقق من صلاحيات الحساب.");
        }

        if (!profile || profile.role !== "school_admin") {
            throw new Error("هذه الصفحة متاحة لمدير المدرسة فقط.");
        }

        const { data: memberships, error: membershipError } = await db
            .from("school_memberships")
            .select("school_id")
            .eq("profile_id", userId)
            .eq("role", "school_admin")
            .limit(2);

        if (membershipError) {
            throw new Error("تعذر تحديد المدرسة المرتبطة بالحساب.");
        }

        if (!memberships || memberships.length !== 1) {
            throw new Error("يجب ربط حساب مدير المدرسة بمدرسة واحدة.");
        }

        const schoolId = memberships[0].school_id;

        const { data: classes, error: classesError } = await db
            .from("classes")
            .select("id, name, stage, grade_name, gender, section_name")
            .eq("school_id", schoolId)
            .order("stage", { ascending: true })
            .order("grade_name", { ascending: true })
            .order("section_name", { ascending: true });

        if (classesError) {
            throw new Error("تعذر تحميل صفوف المدرسة وشعبها.");
        }

        const select = $("studentClassId");
        select.innerHTML = '<option value="">اختر الصف والشعبة</option>';

        (classes || []).forEach((item) => {
            const option = document.createElement("option");
            option.value = String(item.id);

            option.textContent = [
                item.stage,
                item.grade_name || item.name,
                item.gender,
                item.section_name
                    ? `الشعبة ${item.section_name}`
                    : ""
            ].filter(Boolean).join(" — ");

            select.appendChild(option);
        });

        if (!classes || classes.length === 0) {
            select.innerHTML =
                '<option value="">لا توجد صفوف مضافة لهذه المدرسة</option>';
        }
    }

    async function createStudent(event) {
        event.preventDefault();

        const fullName = $("studentFullName").value
            .trim()
            .replace(/\s+/g, " ");

        const classId = Number($("studentClassId").value);
        const button = $("createStudentButton");
        const credentials = $("studentCredentials");

        credentials.hidden = true;

        if (fullName.split(" ").filter(Boolean).length < 4) {
            showMessage("يرجى إدخال الاسم الرباعي كاملًا.", true);
            return;
        }

        if (!Number.isSafeInteger(classId) || classId <= 0) {
            showMessage("اختر الصف والشعبة أولًا.", true);
            return;
        }

        button.disabled = true;
        button.textContent = "جارٍ إنشاء الحساب...";

        showMessage("جارٍ إنشاء حساب الطالب...");

        try {
            const { data, error } = await db.functions.invoke(
                "student-handler",
                {
                    body: {
                        full_name: fullName,
                        class_id: classId
                    }
                }
            );

            if (error) {
                console.error("student-handler error:", error);
                throw new Error(
                    "تعذر الاتصال بخدمة إنشاء الحساب. تحقق من نشر student-handler."
                );
            }

            if (!data || !data.success || !data.student) {
                throw new Error(
                    data?.error || "تعذر إنشاء حساب الطالب."
                );
            }

            $("credentialFullName").textContent =
                data.student.full_name;

            $("credentialUsername").textContent =
                data.student.username;

            $("credentialSecret").textContent =
                data.student.secret_code;

            $("credentialClass").textContent = [
                data.student.class_name,
                data.student.gender,
                data.student.section_name
                    ? `الشعبة ${data.student.section_name}`
                    : ""
            ].filter(Boolean).join(" — ");

            credentials.hidden = false;
            $("studentFullName").value = "";

            showMessage(
                "تم إنشاء الحساب. انسخ بيانات الدخول وسلّمها للطالب."
            );
        } catch (error) {
            console.error("Student creation failed:", error);
            showMessage(
                error.message || "حدث خطأ أثناء إنشاء الحساب.",
                true
            );
        } finally {
            button.disabled = false;
            button.textContent = "إنشاء حساب الطالب";
        }
    }

    async function copyCredentials() {
        const text = [
            `اسم الطالب: ${$("credentialFullName").textContent}`,
            `اسم المستخدم: ${$("credentialUsername").textContent}`,
            `الرمز السري: ${$("credentialSecret").textContent}`,
            `الصف والشعبة: ${$("credentialClass").textContent}`
        ].join("\n");

        try {
            await navigator.clipboard.writeText(text);
            showMessage("تم نسخ بيانات الدخول.");
        } catch {
            showMessage(
                "تعذر النسخ التلقائي. انسخ بيانات الدخول يدويًا.",
                true
            );
        }
    }

    async function initializeStudentManagement() {
        if (!db || !db.auth || !db.from || !db.functions) {
            console.error("Supabase client is unavailable.");
            return;
        }

        addStudentPanel();

        const { data, error } = await db.auth.getUser();

        if (error || !data?.user) {
            showMessage("يرجى تسجيل الدخول بحساب مدير المدرسة.", true);
            return;
        }

        try {
            await loadSchoolClasses(data.user.id);

            $("studentAccountForm").addEventListener(
                "submit",
                createStudent
            );

            $("copyStudentCredentials").addEventListener(
                "click",
                copyCredentials
            );
        } catch (error) {
            console.error("Student management initialization failed:", error);
            showMessage(
                error.message || "تعذر تهيئة إدارة حسابات الطلاب.",
                true
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeStudentManagement
        );
    } else {
        initializeStudentManagement();
    }
})();
