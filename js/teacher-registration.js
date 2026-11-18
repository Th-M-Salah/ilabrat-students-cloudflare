
"use strict";

/*
 * ILABRAT Students — Teacher Registration
 * ربط فعلي مع Supabase Edge Function: teacher-handler
 */

const $ = (id) => document.getElementById(id);

const FUNCTION_NAME = "teacher-handler";

let teachers = [];
let latestGeneratedCode = "";
let toastTimer = null;
let supabaseClient = null;
let currentSchool = null;
let availableClasses = [];
let isSubmitting = false;

function getSupabaseClient() {
    return (
        window.supabaseClient ||
        window.sb ||
        window.supabase?.client ||
        null
    );
}

function showToast(message, isError = false) {
    const toast = $("toast");

    if (!toast) {
        console[isError ? "error" : "log"](message);
        return;
    }

    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}

function updateStats() {
    if ($("totalTeachers")) {
        $("totalTeachers").textContent = String(teachers.length);
    }

    if ($("createdTeachers")) {
        $("createdTeachers").textContent = String(teachers.length);
    }

    if ($("totalCodes")) {
        $("totalCodes").textContent = String(
            teachers.filter((teacher) => Boolean(teacher.code)).length
        );
    }
}

/* إدارة حقل المادة الأخرى */
function initCustomSubject() {
    const subjectSelect = $("teacherSubject");
    const customSubject = $("customSubject");
    const teacherForm = $("teacherForm");

    if (!subjectSelect || !customSubject || !teacherForm) {
        return;
    }

    function updateCustomSubject() {
        const isOther = subjectSelect.value === "أخرى";

        customSubject.style.display = isOther ? "block" : "none";
        customSubject.required = isOther;
        customSubject.disabled = !isOther;

        if (!isOther) {
            customSubject.value = "";
        }
    }

    subjectSelect.addEventListener("change", updateCustomSubject);

    teacherForm.addEventListener("reset", () => {
        requestAnimationFrame(updateCustomSubject);
    });

    updateCustomSubject();
}

function getSubject() {
    const selected = $("teacherSubject")?.value?.trim() || "";

    if (selected !== "أخرى") {
        return selected;
    }

    return $("customSubject")?.value?.trim() || "";
}

/*
 * إضافة اختيار الصف إلى النموذج إن لم يكن موجودًا.
 */
function ensureClassSelector() {
    const form = $("teacherForm");

    if (!form || $("teacherClass")) return;

    const subjectField = $("teacherSubject");

    const subjectContainer =
        subjectField?.closest(".form-group, .form-field, .input-group") ||
        subjectField?.parentElement;

    const wrapper = document.createElement("div");

    wrapper.className = subjectContainer?.className || "form-group";
    wrapper.id = "teacherClassWrapper";

    wrapper.innerHTML = `
        <label for="teacherClass">الصف أو الشعبة</label>
        <select id="teacherClass" name="teacherClass" required>
            <option value="">جارٍ تحميل الصفوف...</option>
        </select>
        <small id="teacherClassHelp">
            اختر الصف الذي سيُسند إليه المعلم.
        </small>
    `;

    if (subjectContainer?.parentElement) {
        subjectContainer.insertAdjacentElement("afterend", wrapper);
    } else {
        form.appendChild(wrapper);
    }
}

function setClassOptions(classes) {
    const select = $("teacherClass");

    if (!select) return;

    if (!classes.length) {
        select.innerHTML = `
            <option value="">لا توجد صفوف مسجلة لهذه المدرسة</option>
        `;
        select.disabled = true;
        return;
    }

    select.disabled = false;

    select.innerHTML = `
        <option value="">اختر الصف أو الشعبة</option>
        ${classes.map((item) => {
            const parts = [
                item.stage,
                item.grade_name,
                item.section_name,
                item.name
            ].filter(Boolean);

            const label = [...new Set(parts)].join(" — ");

            return `
                <option value="${escapeHTML(item.id)}">
                    ${escapeHTML(label || `الصف ${item.id}`)}
                </option>
            `;
        }).join("")}
    `;
}

/*
 * تحميل المدرسة المرتبطة بمدير المدرسة الحالي
 * ثم تحميل صفوف المدرسة.
 */
async function loadSchoolAndClasses() {
    supabaseClient = getSupabaseClient();

    if (!supabaseClient?.auth || !supabaseClient?.from) {
        throw new Error(
            "لم يتم العثور على عميل Supabase. تأكد من تحميل ملف الإعداد قبل teacher-registration.js."
        );
    }

    const {
        data: { user },
        error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        throw new Error(
            "يجب تسجيل الدخول إلى حساب مدير المدرسة قبل إنشاء حساب معلم."
        );
    }

    const {
        data: memberships,
        error: membershipError
    } = await supabaseClient
        .from("school_memberships")
        .select("school_id, role")
        .eq("profile_id", user.id)
        .eq("role", "school_admin");

    if (membershipError) {
        throw new Error(
            `تعذر تحميل عضوية المدرسة: ${membershipError.message}`
        );
    }

    if (!memberships?.length) {
        throw new Error(
            "لا توجد مدرسة مرتبطة بحسابك بصلاحية مدير مدرسة."
        );
    }

    const schoolIds = [
        ...new Set(memberships.map((item) => item.school_id))
    ];

    if (schoolIds.length !== 1) {
        throw new Error(
            "حسابك مرتبط بأكثر من مدرسة. يلزم اختيار المدرسة قبل إنشاء الحساب."
        );
    }

    const schoolId = schoolIds[0];

    const {
        data: school,
        error: schoolError
    } = await supabaseClient
        .from("schools")
        .select("id, name, is_active")
        .eq("id", schoolId)
        .maybeSingle();

    if (schoolError || !school) {
        throw new Error(
            `تعذر العثور على المدرسة: ${schoolError?.message || "لا توجد بيانات"}`
        );
    }

    if (school.is_active === false) {
        throw new Error("هذه المدرسة غير مفعّلة حاليًا.");
    }

    currentSchool = school;

    const {
        data: classes,
        error: classesError
    } = await supabaseClient
        .from("classes")
        .select("id, name, stage, grade_name, section_name")
        .eq("school_id", school.id)
        .order("id");

    if (classesError) {
        throw new Error(
            `تعذر تحميل صفوف المدرسة: ${classesError.message}`
        );
    }

    availableClasses = classes || [];
    setClassOptions(availableClasses);

    // دعم معرّف بطاقة المدرسة في القائمة الجانبية الموحدة
    const schoolLabel =
        $("schoolDisplayName") || $("currentSchoolName");

    if (schoolLabel) {
        schoolLabel.textContent = school.name;
    }
}

function renderTeachers() {
    const tbody = $("teachersTableBody");

    if (!tbody) return;

    const query =
        $("searchInput")?.value?.trim().toLowerCase() || "";

    const filtered = teachers.filter((teacher) => {
        const searchableText = [
            teacher.name,
            teacher.email,
            teacher.phone,
            teacher.subject,
            teacher.code,
            teacher.schoolName,
            teacher.className
        ].join(" ").toLowerCase();

        return searchableText.includes(query);
    });

    if (!filtered.length) {
        tbody.innerHTML = "";

        const emptyState = $("emptyState");

        if (emptyState) {
            emptyState.hidden = false;

            const heading = emptyState.querySelector("h3");
            const paragraph = emptyState.querySelector("p");

            if (heading) {
                heading.textContent = teachers.length
                    ? "لا توجد نتائج مطابقة"
                    : "لا توجد حسابات معروضة في هذه الجلسة";
            }

            if (paragraph) {
                paragraph.textContent = teachers.length
                    ? "جرّب البحث باسم آخر أو بمادة مختلفة."
                    : "أنشئ حسابًا جديدًا ليظهر هنا. الحسابات السابقة لا تُحمّل في هذه الصفحة حاليًا.";
            }
        }

        updateStats();
        return;
    }

    if ($("emptyState")) {
        $("emptyState").hidden = true;
    }

    tbody.innerHTML = filtered.map((teacher) => `
        <tr>
            <td>
                <span class="teacher-name">
                    ${escapeHTML(teacher.name)}
                </span>
            </td>
            <td>${escapeHTML(teacher.subject)}</td>
            <td>
                <code class="code-cell">${escapeHTML(teacher.code)}</code>
            </td>
            <td>${escapeHTML(formatDate(teacher.createdAt))}</td>
            <td>
                <div class="table-actions">
                    <button
                        type="button"
                        class="small-button"
                        data-action="copy"
                        data-id="${escapeHTML(teacher.id)}"
                    >نسخ الكود</button>
                </div>
            </td>
        </tr>
    `).join("");

    updateStats();
}

function showGeneratedAccount(teacher) {
    latestGeneratedCode = teacher.code || "";

    if ($("generatedTeacherName")) {
        $("generatedTeacherName").textContent =
            `اسم المعلم: ${teacher.name}`;
    }

    if ($("generatedCode")) {
        $("generatedCode").textContent = teacher.code || "—";
    }

    if ($("generatedCodePanel")) {
        $("generatedCodePanel").hidden = false;

        $("generatedCodePanel").scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

/*
 * إنشاء حساب حقيقي باستدعاء Edge Function.
 */
async function createTeacher(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const name = $("teacherName")?.value?.trim() || "";
    const email = $("teacherEmail")?.value?.trim() || "";
    const phone = $("teacherPhone")?.value?.trim() || "";
    const subject = getSubject();
    const classId = Number($("teacherClass")?.value);

    if (!name || !subject) {
        showToast("يرجى إدخال اسم المعلم واختيار المادة.", true);
        return;
    }

    if (!phone) {
        showToast("يرجى إدخال رقم هاتف المعلم.", true);
        $("teacherPhone")?.focus();
        return;
    }

    if (name.split(/\s+/).filter(Boolean).length < 4) {
        showToast(
            "يرجى إدخال اسم المعلم الرباعي كما تتطلب الدالة الحالية.",
            true
        );
        $("teacherName")?.focus();
        return;
    }

    if (subject.length > 150) {
        showToast("اسم المادة طويل جدًا.", true);
        return;
    }

    if (!Number.isSafeInteger(classId) || classId <= 0) {
        showToast("يرجى اختيار الصف أو الشعبة.", true);
        $("teacherClass")?.focus();
        return;
    }

    const selectedClass = availableClasses.find(
        (item) => Number(item.id) === classId
    );

    if (!selectedClass) {
        showToast("الصف المحدد غير موجود ضمن صفوف المدرسة.", true);
        return;
    }

    if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        showToast("يرجى التأكد من صحة البريد الإلكتروني.", true);
        $("teacherEmail")?.focus();
        return;
    }

    if (!supabaseClient || !currentSchool) {
        showToast("لم تكتمل تهيئة الاتصال بقاعدة البيانات.", true);
        return;
    }

    const submitButton = $("teacherForm")?.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    const originalButtonText = submitButton
        ? (submitButton.textContent || submitButton.value)
        : "";

    isSubmitting = true;

    if (submitButton) {
        submitButton.disabled = true;

        if (
            "value" in submitButton &&
            submitButton.tagName === "INPUT"
        ) {
            submitButton.value = "جارٍ إنشاء الحساب...";
        } else {
            submitButton.textContent = "جارٍ إنشاء الحساب...";
        }
    }

    try {
        const { data, error } =
            await supabaseClient.functions.invoke(
                FUNCTION_NAME,
                {
                    body: {
                        action: "create",
                        full_name: name,
                        school_name: currentSchool.name,
                        phone,
                        school_id: currentSchool.id,
                        assignments: [
                            {
                                class_id: classId,
                                subject
                            }
                        ]
                    }
                }
            );

        if (error) {
            let details = error.message || "تعذر الاتصال بالدالة.";

            if (typeof error.context?.json === "function") {
                try {
                    const responseBody = await error.context.json();

                    if (responseBody?.error) {
                        details = responseBody.error;
                    } else if (responseBody?.message) {
                        details = responseBody.message;
                    }
                } catch {
                    // قد لا يكون الرد قابلًا للقراءة كـ JSON.
                }
            }

            throw new Error(details);
        }

        if (!data || data.success !== true) {
            throw new Error(
                data?.error ||
                data?.message ||
                "لم يؤكد الخادم نجاح إنشاء الحساب."
            );
        }

        const teacherData = data.teacher || {};

        const code =
            data.login_code ||
            teacherData.login_code ||
            data.code ||
            "";

        if (!code) {
            throw new Error(
                "استجاب الخادم، لكن كود الدخول غير موجود في الرد. تحقق من صيغة استجابة teacher-handler."
            );
        }

        const teacher = {
            id:
                teacherData.profile_id ||
                teacherData.id ||
                crypto.randomUUID(),

            name: teacherData.full_name || name,
            email,
            phone,
            subject,

            className: [
                selectedClass.stage,
                selectedClass.grade_name,
                selectedClass.section_name,
                selectedClass.name
            ].filter(Boolean).join(" — "),

            schoolName:
                teacherData.school_name || currentSchool.name,

            code,
            createdAt: new Date().toISOString()
        };

        teachers.unshift(teacher);

        renderTeachers();
        showGeneratedAccount(teacher);

        $("teacherForm")?.reset();

        if ($("customSubject")) {
            $("customSubject").value = "";
        }

        if ($("teacherClass")) {
            $("teacherClass").value = "";
        }

        showToast("تم إنشاء حساب المعلم في Supabase بنجاح.");

    } catch (error) {
        console.error("Teacher registration failed:", error);

        showToast(
            error.message ||
            "تعذر إنشاء الحساب. راجع إعدادات الدالة والصلاحيات.",
            true
        );

    } finally {
        isSubmitting = false;

        if (submitButton) {
            submitButton.disabled = false;

            if (
                "value" in submitButton &&
                submitButton.tagName === "INPUT"
            ) {
                submitButton.value = originalButtonText;
            } else {
                submitButton.textContent = originalButtonText;
            }
        }
    }
}

async function copyText(text) {
    if (!text) {
        showToast("لا يوجد كود لنسخه.", true);
        return;
    }

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement("textarea");

            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";

            document.body.appendChild(textarea);
            textarea.select();

            const copied = document.execCommand("copy");
            textarea.remove();

            if (!copied) {
                throw new Error("تعذر النسخ");
            }
        }

        showToast("تم نسخ كود دخول المعلم.");

    } catch (error) {
        showToast(`تعذر النسخ التلقائي. الكود: ${text}`, true);
    }
}

function handleTableAction(event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const teacher = teachers.find(
        (item) => String(item.id) === String(button.dataset.id)
    );

    if (!teacher) {
        showToast("لم يتم العثور على الحساب في القائمة الحالية.", true);
        return;
    }

    if (button.dataset.action === "copy") {
        void copyText(teacher.code);
    }
}

/* تصدير الحسابات التي أُنشئت خلال الجلسة الحالية */
function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportTeachers() {
    if (!teachers.length) {
        showToast("لا توجد حسابات معروضة لتصديرها.", true);
        return;
    }

    const headers = [
        "اسم المعلم",
        "البريد الإلكتروني",
        "رقم الهاتف",
        "المادة",
        "الصف",
        "المدرسة",
        "كود الدخول",
        "تاريخ الإنشاء"
    ];

    const rows = teachers.map((teacher) => [
        teacher.name,
        teacher.email,
        teacher.phone,
        teacher.subject,
        teacher.className,
        teacher.schoolName,
        teacher.code,
        formatDate(teacher.createdAt)
    ]);

    const csv = "\uFEFF" + [headers, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\r\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ilabrat-teacher-accounts.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("تم تصدير الحسابات المعروضة.");
}

async function init() {
    const form = $("teacherForm");

    if (!form) {
        console.error("لم يتم العثور على teacherForm في الصفحة.");
        return;
    }

    ensureClassSelector();
    initCustomSubject();

    form.addEventListener("submit", createTeacher);

    $("searchInput")?.addEventListener("input", renderTeachers);

    $("teachersTableBody")?.addEventListener(
        "click",
        handleTableAction
    );

    $("copyCodeButton")?.addEventListener("click", () => {
        if (latestGeneratedCode) {
            void copyText(latestGeneratedCode);
        }
    });

    $("exportButton")?.addEventListener("click", exportTeachers);

    $("resetButton")?.addEventListener("click", () => {
        if ($("generatedCodePanel")) {
            $("generatedCodePanel").hidden = true;
        }

        latestGeneratedCode = "";
    });

    try {
        await loadSchoolAndClasses();

        showToast("تم الاتصال بقاعدة البيانات وتحميل صفوف المدرسة.");

    } catch (error) {
        console.error("Teacher page initialization failed:", error);

        showToast(error.message || "تعذر تجهيز الصفحة.", true);

        const select = $("teacherClass");

        if (select) {
            select.innerHTML = `
                <option value="">تعذر تحميل الصفوف</option>
            `;
            select.disabled = true;
        }
    }

    renderTeachers();
}

document.addEventListener("DOMContentLoaded", init);
