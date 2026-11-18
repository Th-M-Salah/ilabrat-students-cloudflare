
"use strict";

/* =========================================================
   ILABRAT Students — Student Accounts
   إنشاء حساب الطالب، عرض بيانات الدخول، إنشاء QR والطباعة
   ========================================================= */

(() => {
    const $ = (id) => document.getElementById(id);

    const state = {
        currentSchoolId: null,
        currentSchoolName: "",
        db: null,
        currentUser: null,
        currentProfile: null,
        classes: [],
        selectedClass: null,
        schoolNames: new Map(),
        currentStudent: null,
        qrReady: false,
        creating: false
    };

    function showMessage(message, type = "info") {
        const element = $("studentFormMessage");
        if (!element) return;

        element.textContent = message;
        element.className = `student-form-message ${type}`;
        element.hidden = false;
        element.setAttribute("role", "status");
    }

    function clearMessage() {
        const element = $("studentFormMessage");
        if (!element) return;

        element.textContent = "";
        element.className = "student-form-message";
        element.hidden = true;
    }

    function setHidden(id, hidden) {
        const element = $(id);
        if (element) element.hidden = hidden;
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value ?? "";
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function getClient() {
        return window.supabaseClient || window.supabase || null;
    }

    function getClassLabel(schoolClass) {
        if (!schoolClass) return "";

        const parts = [
            schoolClass.stage,
            schoolClass.grade_name || schoolClass.name,
            schoolClass.gender,
            schoolClass.section_name
                ? `شعبة ${schoolClass.section_name}`
                : ""
        ].filter(Boolean);

        return parts.join(" — ");
    }

    function clearCreatedStudentDisplay() {
        state.currentStudent = null;
        state.qrReady = false;

        setHidden("studentCredentialsPanel", true);
        setHidden("studentQrPanel", true);

        [
            "createdStudentSchool",
            "createdStudentName",
            "createdStudentClass",
            "createdStudentUsername",
            "createdStudentSecret",
            "qrStudentSchool",
            "qrStudentName",
            "qrStudentClass",
            "qrStudentUsername",
            "qrStudentSecret"
        ].forEach((id) => setText(id, ""));

        const qrContainer = $("studentQrCode");
        if (qrContainer) qrContainer.replaceChildren();

        clearMessage();
    }

    async function getSchoolName(schoolId) {
        if (!schoolId) return "غير محددة";

        const key = String(schoolId);

        if (state.schoolNames.has(key)) {
            return state.schoolNames.get(key);
        }

        if (!state.db) return "تعذر تحميل اسم المدرسة";

        const { data, error } = await state.db
            .from("schools")
            .select("id, name")
            .eq("id", schoolId)
            .maybeSingle();

        if (error) {
            console.error("تعذر جلب اسم المدرسة:", error);
            return "تعذر تحميل اسم المدرسة";
        }

        const schoolName = data?.name || "تعذر تحديد المدرسة";
        state.schoolNames.set(key, schoolName);

        return schoolName;
    }

    async function updateSelectedClass() {
        const select = $("studentClass");
        const schoolNameElement = $("studentSchoolName");
        const detailsElement = $("studentSchoolDetails");

        if (!select) return;

        const selectedId = select.value;

        state.selectedClass =
            state.classes.find(
                (item) => String(item.id) === String(selectedId)
            ) || null;

        if (!state.selectedClass) {
            if (schoolNameElement) {
                schoolNameElement.textContent =
                    state.currentSchoolName || "غير محددة";
            }

            if (detailsElement) {
                detailsElement.textContent =
                    "اختر الصف والشعبة لعرض بيانات المدرسة.";
            }

            // اسم المدرسة في القائمة الجانبية مستقل عن اختيار الصف.
            setText(
                "schoolDisplayName",
                state.currentSchoolName || "تعذر تحديد المدرسة"
            );

            return;
        }

        const schoolName = await getSchoolName(
            state.selectedClass.school_id
        );

        if (schoolNameElement) {
            schoolNameElement.textContent = schoolName;
        }

        if (detailsElement) {
            detailsElement.textContent =
                getClassLabel(state.selectedClass);
        }

        // لا نغيّر اسم المدرسة في القائمة الجانبية عند تغيير الصف.
        setText(
            "schoolDisplayName",
            state.currentSchoolName || "تعذر تحديد المدرسة"
        );
    }

    async function loadClasses() {
        const select = $("studentClass");
        if (!select || !state.db) return;

        select.disabled = true;
        select.innerHTML =
            '<option value="">جارٍ تحميل الصفوف والشعب...</option>';

        const { data, error } = await state.db
            .from("classes")
            .select(
                "id, school_id, name, stage, grade_name, gender, section_name"
            )
            .order("stage", { ascending: true })
            .order("grade_name", { ascending: true })
            .order("section_name", { ascending: true });

        if (error) {
            console.error("تعذر تحميل الصفوف:", error);

            select.innerHTML =
                '<option value="">تعذر تحميل الصفوف والشعب</option>';

            select.disabled = false;

            setText(
                "connectionNotice",
                "تم التحقق من تسجيل الدخول، لكن تعذر تحميل الصفوف والشعب. تحقق من صلاحيات قاعدة البيانات."
            );

            showMessage(
                "تعذر تحميل الصفوف والشعب. تحقق من الاتصال والصلاحيات ثم أعد تحميل الصفحة.",
                "error"
            );

            return;
        }

        state.classes = data || [];

        if (!state.classes.length) {
            select.innerHTML =
                '<option value="">لا توجد صفوف متاحة</option>';

            select.disabled = false;

            setText(
                "connectionNotice",
                "تم التحقق من الحساب، لكن لا توجد صفوف متاحة لهذا الحساب."
            );

            // لا نستبدل اسم المدرسة برسالة عدم وجود صفوف.
            setText(
                "schoolDisplayName",
                state.currentSchoolName || "تعذر تحديد المدرسة"
            );

            return;
        }

        select.innerHTML =
            '<option value="">اختر الصف والشعبة</option>' +
            state.classes.map((schoolClass) => {
                const label =
                    getClassLabel(schoolClass) ||
                    schoolClass.name ||
                    `صف ${schoolClass.id}`;

                return `<option value="${escapeHTML(schoolClass.id)}">${escapeHTML(label)}</option>`;
            }).join("");

        select.disabled = false;

        await updateSelectedClass();
    }

    async function loadCurrentUser() {
        if (!state.db) {
            throw new Error(
                "لم يتم العثور على اتصال Supabase. تحقق من ملف إعداد الاتصال."
            );
        }

        const { data: authData, error: authError } =
            await state.db.auth.getUser();

        if (authError) throw authError;

        const user = authData?.user;

        if (!user) {
            throw new Error("انتهت جلسة الدخول. سجّل الدخول مجددًا.");
        }

        state.currentUser = user;

        const { data: profile, error: profileError } =
            await state.db
                .from("profiles")
                .select("id, full_name, role")
                .eq("id", user.id)
                .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
            throw new Error(
                "لم يتم العثور على ملف المستخدم في جدول profiles."
            );
        }

        if (!["admin", "school_admin"].includes(profile.role)) {
            throw new Error("ليس لديك صلاحية إنشاء حسابات الطلاب.");
        }

        state.currentProfile = profile;

        const displayName = $("adminDisplayName");

        if (displayName) {
            displayName.textContent =
                profile.full_name || "مدير المدرسة";
        }

        if (profile.role === "admin") {
            state.currentSchoolId = null;
            state.currentSchoolName = "مدير التطبيق";

            setText("schoolDisplayName", state.currentSchoolName);

            setText(
                "connectionNotice",
                "تم التحقق من تسجيل الدخول. صلاحية مدير التطبيق تسمح بإنشاء حسابات الطلاب."
            );

            return;
        }

        // جلب المدرسة المرتبطة بمدير المدرسة.
        const { data: membership, error: membershipError } =
            await state.db
                .from("school_memberships")
                .select("school_id")
                .eq("profile_id", user.id)
                .eq("role", "school_admin")
                .maybeSingle();

        if (membershipError) {
            console.error(
                "تعذر جلب عضوية المدرسة:",
                membershipError
            );
            throw membershipError;
        }

        if (!membership?.school_id) {
            throw new Error(
                "لم يتم العثور على مدرسة مرتبطة بحساب مدير المدرسة."
            );
        }

        state.currentSchoolId = membership.school_id;

        // جلب اسم المدرسة من جدول المدارس.
        state.currentSchoolName = await getSchoolName(
            state.currentSchoolId
        );

        setText(
            "schoolDisplayName",
            state.currentSchoolName
        );

        setText(
            "connectionNotice",
            "تم التحقق من تسجيل الدخول وصلاحية مدير المدرسة."
        );
    }

    function extractErrorMessage(error) {
        if (!error) return "حدث خطأ غير معروف.";

        if (typeof error === "string") return error;

        return error.message
            || error.details
            || error.hint
            || error.msg
            || "تعذر تنفيذ العملية.";
    }

    function renderStudentCredentials(
        student,
        schoolName,
        classLabel
    ) {
        const name = student.full_name || student.name || "";
        const username =
            student.username || student.login_name || "";
        const secret =
            student.secret_code || student.secret || "";

        state.currentStudent = {
            ...student,
            full_name: name,
            username,
            secret_code: secret,
            school_name: schoolName,
            class_label: classLabel
        };

        setText("createdStudentSchool", schoolName);
        setText("createdStudentName", name);
        setText("createdStudentClass", classLabel);
        setText("createdStudentUsername", username);
        setText("createdStudentSecret", secret);

        setText("qrStudentSchool", schoolName);
        setText("qrStudentName", name);
        setText("qrStudentClass", classLabel);
        setText("qrStudentUsername", username);
        setText("qrStudentSecret", secret);

        // إظهار بيانات الطالب تلقائيًا بعد نجاح الإنشاء.
        setHidden("studentCredentialsPanel", false);

        // إظهار بطاقة QR كذلك بعد الإنشاء.
        setHidden("studentQrPanel", false);

        renderStudentQr(username);

        const panel = $("studentCredentialsPanel");

        if (panel) {
            panel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    
function renderStudentQr(username) {
    const container = $("studentQrCode");
    if (!container) return;

    container.replaceChildren();
    state.qrReady = false;

    if (!username) {
        container.textContent =
            "لا يتوفر اسم دخول لإنشاء رمز QR.";
        return;
    }

    if (typeof window.QRCode !== "function") {
        container.textContent =
            "تعذر تحميل مكتبة QR. أعد تحميل الصفحة.";
        console.error("مكتبة QRCode غير متاحة.");
        return;
    }

    try {
        new window.QRCode(container, {
            text: String(username),
            width: 150,
            height: 150,
            colorDark: "#43131D",
            colorLight: "#FFFFFF",
            correctLevel: window.QRCode.CorrectLevel.L
        });

        state.qrReady = true;

    } catch (error) {
        console.error("تعذر إنشاء QR:", error);
        container.textContent =
            "تعذر إنشاء رمز QR.";
    }
}


    async function createStudent(event) {
        if (event) event.preventDefault();

        if (state.creating) return;

        const nameInput = $("studentFullName");
        const classSelect = $("studentClass");
        const createButton = $("createStudentButton");

        const fullName = nameInput?.value.trim() || "";
        const classId = classSelect?.value || "";

        if (!fullName) {
            showMessage("أدخل اسم الطالب أولًا.", "error");
            nameInput?.focus();
            return;
        }

        if (!classId) {
            showMessage(
                "اختر الصف والشعبة قبل إنشاء الحساب.",
                "error"
            );

            classSelect?.focus();
            return;
        }

        const selectedClass = state.classes.find(
            (item) => String(item.id) === String(classId)
        );

        if (!selectedClass) {
            showMessage(
                "الصف المختار غير موجود. أعد اختيار الصف.",
                "error"
            );
            return;
        }

        if (!state.db) {
            showMessage(
                "الاتصال بقاعدة البيانات غير جاهز.",
                "error"
            );
            return;
        }

        state.creating = true;
        clearMessage();

        if (createButton) {
            createButton.disabled = true;

            createButton.dataset.originalText =
                createButton.textContent ||
                "إنشاء حساب الطالب";

            createButton.textContent =
                "جارٍ إنشاء الحساب...";
        }

        try {
            const { data, error } =
                await state.db.functions.invoke(
                    "student-handler",
                    {
                        body: {
                            full_name: fullName,
                            class_id: selectedClass.id
                        }
                    }
                );

            if (error) {
                let detail = extractErrorMessage(error);

                if (
                    error.context &&
                    typeof error.context.json === "function"
                ) {
                    try {
                        const responseBody =
                            await error.context.json();

                        detail =
                            responseBody.message ||
                            responseBody.error ||
                            detail;
                    } catch (_) {
                        // الاحتفاظ برسالة الخطأ الأصلية.
                    }
                }

                throw new Error(detail);
            }

            if (!data || data.success !== true) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "لم يؤكد الخادم نجاح إنشاء حساب الطالب."
                );
            }

            const studentData = {
                ...(data.student || {}),
                full_name:
                    data.student?.full_name || fullName,

                username:
                    data.username ||
                    data.student?.username ||
                    data.student?.login_name ||
                    "",

                secret_code:
                    data.secret_code ||
                    data.student?.secret_code ||
                    ""
            };

            if (
                !studentData.username ||
                !studentData.secret_code
            ) {
                console.warn(
                    "استجابة إنشاء الطالب لا تحتوي على جميع بيانات الدخول:",
                    data
                );
            }

            const schoolName = await getSchoolName(
                selectedClass.school_id
            );

            const classLabel =
                getClassLabel(selectedClass) ||
                selectedClass.name ||
                "";

            renderStudentCredentials(
                studentData,
                schoolName,
                classLabel
            );

            showMessage(
                "تم إنشاء حساب الطالب بنجاح. احفظ اسم الدخول والرمز السري قبل الانتقال إلى طالب آخر.",
                "success"
            );

            // لا نمسح الاسم تلقائيًا؛ يستطيع المدير مراجعة البيانات أولًا.
        } catch (error) {
            console.error(
                "خطأ إنشاء حساب الطالب:",
                error
            );

            showMessage(
                `تعذر إنشاء حساب الطالب: ${extractErrorMessage(error)}`,
                "error"
            );
        } finally {
            state.creating = false;

            if (createButton) {
                createButton.disabled = false;

                createButton.textContent =
                    createButton.dataset.originalText ||
                    "إنشاء حساب الطالب";
            }
        }
    }

    function resetForm(event) {
        if (event) event.preventDefault();

        // إخفاء بيانات الطالب السابق فقط؛ لا يُحذف الحساب من قاعدة البيانات.
        clearCreatedStudentDisplay();

        const form = $("studentAccountForm");
        if (form) form.reset();

        // استعادة قائمة الصفوف إلى خيار الاختيار الأول.
        const classSelect = $("studentClass");

        if (classSelect) {
            classSelect.value = "";
        }

        state.selectedClass = null;

        setText(
            "studentSchoolName",
            state.currentSchoolName || "غير محددة"
        );

        setText(
            "studentSchoolDetails",
            "اختر الصف والشعبة لعرض بيانات المدرسة."
        );

        // إبقاء اسم المدرسة ظاهرًا بعد إعادة ضبط النموذج.
        setText(
            "schoolDisplayName",
            state.currentSchoolName || "تعذر تحديد المدرسة"
        );

        const nameInput = $("studentFullName");
        if (nameInput) nameInput.focus();
    }

    async function copyText(text, label) {
        if (!text) {
            showMessage(
                `لا توجد بيانات لنسخها: ${label}.`,
                "error"
            );
            return;
        }

        try {
            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {
                await navigator.clipboard.writeText(
                    String(text)
                );
            } else {
                const temporary =
                    document.createElement("textarea");

                temporary.value = String(text);
                temporary.style.position = "fixed";
                temporary.style.opacity = "0";

                document.body.appendChild(temporary);
                temporary.select();

                const copied =
                    document.execCommand("copy");

                temporary.remove();

                if (!copied) {
                    throw new Error("تعذر نسخ النص.");
                }
            }

            showMessage(
                `تم نسخ ${label} بنجاح.`,
                "success"
            );
        } catch (error) {
            console.error("خطأ النسخ:", error);

            showMessage(
                "تعذر النسخ تلقائيًا. حدّد النص وانسخه يدويًا.",
                "error"
            );
        }
    }

    function getElementText(id) {
        return $(id)?.textContent?.trim() || "";
    }

    async function handleCopyButton(event) {
        const button = event.target.closest("[data-copy]");
        if (!button) return;

        const targetId = button.dataset.copy;
        const target = $(targetId);

        if (!target) return;

        await copyText(
            target.textContent.trim(),
            "البيانات المطلوبة"
        );
    }

    async function copyAllCredentials() {
        if (!state.currentStudent) {
            showMessage(
                "أنشئ حساب الطالب أولًا.",
                "error"
            );
            return;
        }

        const lines = [
            `المدرسة: ${getElementText("createdStudentSchool")}`,
            `اسم الطالب: ${getElementText("createdStudentName")}`,
            `الصف والشعبة: ${getElementText("createdStudentClass")}`,
            `اسم الدخول: ${getElementText("createdStudentUsername")}`,
            `الرمز السري: ${getElementText("createdStudentSecret")}`
        ];

        await copyText(
            lines.join("\n"),
            "بيانات الطالب كاملة"
        );
    }

    function printStudentInfo() {
        if (!state.currentStudent) {
            showMessage(
                "أنشئ حساب الطالب أولًا قبل الطباعة.",
                "error"
            );
            return;
        }

        const student = state.currentStudent;
        const qrContainer = $("studentQrCode");

        const qrImage =
            qrContainer?.querySelector("img");

        const qrCanvas =
            qrContainer?.querySelector("canvas");

        let qrMarkup = "";

        if (qrImage?.src) {
            qrMarkup =
                `<img class="qr-image" src="${escapeHTML(qrImage.src)}" alt="رمز QR للطالب">`;
        } else if (qrCanvas) {
            try {
                qrMarkup =
                    `<img class="qr-image" src="${qrCanvas.toDataURL("image/png")}" alt="رمز QR للطالب">`;
            } catch (_) {
                qrMarkup =
                    "<p>تعذر تضمين رمز QR في الطباعة.</p>";
            }
        } else {
            qrMarkup =
                "<p>رمز QR غير متوفر.</p>";
        }

        const logoUrl =
            new URL(
                "assets/ilabrat-logo.png",
                document.baseURI
            ).href;

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=800,height=700"
            );

        if (!printWindow) {
            showMessage(
                "المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مجددًا.",
                "error"
            );
            return;
        }

        printWindow.document.open();

        printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بطاقة الطالب - ${escapeHTML(student.full_name)}</title>
<style>
    @page { size: A5 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        padding: 12px;
        font-family: Tahoma, Arial, sans-serif;
        color: #43131D;
        background: #fff;
    }
    .card {
        width: 100%;
        max-width: 500px;
        margin: 0 auto;
        padding: 18px;
        border: 2px solid #5A1825;
        border-radius: 14px;
        text-align: center;
    }
    .logo { width: 62px; height: 62px; object-fit: contain; }
    h1 { margin: 7px 0; font-size: 19px; }
    .school { margin-bottom: 12px; color: #7A2A39; font-size: 14px; }
    .student { margin: 12px 0; padding: 10px; background: #F3EEE7; border-radius: 8px; }
    .line { margin: 8px 0; font-size: 14px; overflow-wrap: anywhere; }
    .label { font-weight: bold; }
    .qr { margin: 12px auto; }
    .qr-image { display: block; width: 135px; height: 135px; object-fit: contain; margin: auto; }
    .note { margin-top: 10px; font-size: 11px; color: #555; }
    @media print {
        body { padding: 0; }
        .card { max-width: none; }
    }
</style>
</head>
<body>
    <main class="card">
        <img class="logo" src="${escapeHTML(logoUrl)}" alt="شعار إيلابرات">
        <h1>بطاقة بيانات الطالب</h1>
        <div class="school">${escapeHTML(student.school_name)}</div>
        <div class="student">
            <div class="line"><span class="label">اسم الطالب:</span> ${escapeHTML(student.full_name)}</div>
            <div class="line"><span class="label">الصف والشعبة:</span> ${escapeHTML(student.class_label)}</div>
        </div>
        <div class="line"><span class="label">اسم الدخول:</span> ${escapeHTML(student.username)}</div>
        <div class="line"><span class="label">الرمز السري:</span> ${escapeHTML(student.secret_code)}</div>
        <div class="qr">${qrMarkup}</div>
        <div class="note">رمز QR يحتوي على اسم الدخول فقط، ولا يحتوي على الرمز السري.</div>
    </main>
    <script>
        window.addEventListener("load", () => {
            setTimeout(() => window.print(), 300);
        });
    <\/script>
</body>
</html>`);

        printWindow.document.close();
    }

    function showStudentInfo() {
        if (!state.currentStudent) {
            showMessage(
                "لا توجد بيانات طالب لعرضها. أنشئ حسابًا أولًا.",
                "error"
            );
            return;
        }

        setHidden("studentCredentialsPanel", false);
        setHidden("studentQrPanel", false);

        $("studentCredentialsPanel")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function generateStudentQr() {
        if (!state.currentStudent) {
            showMessage(
                "أنشئ حساب الطالب أولًا.",
                "error"
            );
            return;
        }

        setHidden("studentQrPanel", false);

        renderStudentQr(
            state.currentStudent.username
        );

        $("studentQrPanel")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function bindEvents() {
        $("studentAccountForm")?.addEventListener(
            "submit",
            createStudent
        );

        $("resetStudentForm")?.addEventListener(
            "click",
            resetForm
        );

        $("studentClass")?.addEventListener(
            "change",
            () => {
                updateSelectedClass().catch((error) => {
                    console.error(
                        "خطأ تحديث الصف المختار:",
                        error
                    );
                });
            }
        );

        document.addEventListener("click", (event) => {
            const target = event.target;

            if (!(target instanceof Element)) return;

            if (target.closest("[data-copy]")) {
                handleCopyButton(event);
                return;
            }

            if (
                target.closest(
                    "#copyAllStudentCredentials"
                )
            ) {
                copyAllCredentials();
                return;
            }

            if (target.closest("#printStudentInfo")) {
                printStudentInfo();
                return;
            }

            if (target.closest("#showStudentInfo")) {
                showStudentInfo();
                return;
            }

            if (target.closest("#generateStudentQr")) {
                generateStudentQr();
            }
        });
    }

    async function init() {
        state.db = getClient();

        bindEvents();
        clearCreatedStudentDisplay();

        try {
            await loadCurrentUser();
            await loadClasses();
        } catch (error) {
            console.error(
                "تهيئة صفحة حسابات الطلاب فشلت:",
                error
            );

            setText(
                "connectionNotice",
                `تعذر التحقق من الاتصال أو الصلاحيات: ${extractErrorMessage(error)}`
            );

            setText(
                "schoolDisplayName",
                state.currentSchoolName || "تعذر تحميل بيانات المدرسة"
            );

            showMessage(
                extractErrorMessage(error),
                "error"
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }
})();
