
"use strict";

/*
 * ILABRAT Students — Teacher Accounts
 * قراءة حسابات المعلمين وتكليفاتهم من Supabase.
 * يدعم تعديل الاسم والهاتف والتكليفات وحذف حساب المعلم.
 */

(() => {
    const $ = (id) => document.getElementById(id);

    let teachers = [];
    let activeSchoolId = null;
    let activeSchoolName = "";
    let schoolClasses = [];
    let toastTimer = null;

    // التكليفات القديمة التي طلب المستخدم حذفها أثناء التعديل.
    let removedEditAssignments = [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function setMessage(message, type = "info") {
        const element = $("pageMessage");
        if (!element) return;

        element.textContent = message || "";
        element.className = message
            ? `form-message show ${type}`
            : "form-message";
    }

    function showToast(message) {
        const toast = $("toast");
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(
            () => toast.classList.remove("show"),
            3000
        );
    }

    function unique(values) {
        return [...new Set(values.filter(Boolean))];
    }

    function teacherSubjects(teacher) {
        return unique(teacher.assignments.map((item) => item.subject));
    }

    function teacherStages(teacher) {
        return unique(teacher.assignments.map((item) => item.stage));
    }

    function teacherSections(teacher) {
        return unique(
            teacher.assignments.map((item) =>
                [
                    item.grade,
                    item.section ? `شعبة ${item.section}` : ""
                ].filter(Boolean).join(" — ")
            )
        );
    }

    function renderStats() {
        $("totalTeachers").textContent = String(teachers.length);

        $("totalSubjects").textContent = String(
            unique(teachers.flatMap(teacherSubjects)).length
        );

        $("totalClasses").textContent = String(
            unique(
                teachers.flatMap((teacher) =>
                    teacher.assignments.map((item) => item.classKey)
                )
            ).length
        );
    }

    function updateSubjectFilter() {
        const filter = $("subjectFilter");
        if (!filter) return;

        const previous = filter.value;

        const values = unique(
            teachers.flatMap(teacherSubjects)
        ).sort((a, b) => a.localeCompare(b, "ar"));

        filter.innerHTML =
            '<option value="">جميع المواد</option>' +
            values.map((subject) =>
                `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>`
            ).join("");

        if (values.includes(previous)) {
            filter.value = previous;
        }
    }

    function renderEmpty(message, description = "") {
        const body = $("teachersTableBody");
        if (!body) return;

        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="empty-icon">♙</div>
                    <strong>${escapeHTML(message)}</strong>
                    ${description
                        ? `<p>${escapeHTML(description)}</p>`
                        : ""}
                </td>
            </tr>
        `;
    }

    function renderTeachers() {
        const body = $("teachersTableBody");
        if (!body) return;

        const query = $("teacherSearch")?.value
            .trim().toLocaleLowerCase("ar") || "";

        const subject = $("subjectFilter")?.value || "";
        const stage = $("stageFilter")?.value || "";

        const filtered = teachers.filter((teacher) => {
            const searchable = [
                teacher.name,
                ...teacherSubjects(teacher),
                ...teacherStages(teacher),
                ...teacherSections(teacher)
            ].join(" ").toLocaleLowerCase("ar");

            const matchesQuery =
                !query || searchable.includes(query);

            const matchesSubject =
                !subject ||
                teacher.assignments.some(
                    (item) => item.subject === subject
                );

            const matchesStage =
                !stage ||
                teacher.assignments.some(
                    (item) => item.stage === stage
                );

            return matchesQuery && matchesSubject && matchesStage;
        });

        const resultsCount = $("resultsCount");
        if (resultsCount) {
            resultsCount.textContent =
                `عدد المعلمين: ${filtered.length} من ${teachers.length}`;
        }

        renderStats();
        updateSubjectFilter();

        if (!filtered.length) {
            renderEmpty(
                teachers.length
                    ? "لا توجد نتائج مطابقة للبحث"
                    : "لا توجد حسابات معلمين مرتبطة بهذه المدرسة",
                teachers.length
                    ? "جرّب تغيير كلمات البحث أو خيارات التصفية."
                    : "ستظهر هنا الحسابات المرتبطة بمدرستك."
            );
            return;
        }

        body.innerHTML = filtered.map((teacher) => {
            const subjects = teacherSubjects(teacher);
            const stages = teacherStages(teacher);
            const sections = teacherSections(teacher);

            return `
                <tr>
                    <td>
                        <div class="teacher-cell">
                            <div class="teacher-avatar">
                                ${escapeHTML(
                                    (teacher.name || "م")
                                        .trim()
                                        .charAt(0)
                                )}
                            </div>

                            <div>
                                <strong>${escapeHTML(teacher.name)}</strong>
                                <small>${teacher.phone
                                    ? `الهاتف: ${escapeHTML(teacher.phone)}`
                                    : "حساب معلم في إيلابرات"}</small>
                            </div>
                        </div>
                    </td>

                    <td>
                        <div class="subject-tags">
                            ${
                                subjects.map((value) =>
                                    `<span class="subject-tag">${escapeHTML(value)}</span>`
                                ).join("") || "—"
                            }
                        </div>
                    </td>

                    <td>
                        <div class="subject-tags">
                            ${
                                stages.map((value) =>
                                    `<span class="stage-label">${escapeHTML(value)}</span>`
                                ).join("") || "—"
                            }
                        </div>
                    </td>

                    <td>
                        <div class="section-tags">
                            ${
                                sections.map((value) =>
                                    `<span class="section-tag">${escapeHTML(value)}</span>`
                                ).join("") || "لم تُسند شعبة"
                            }
                        </div>
                    </td>

                    <td>
                        <span class="status-label">مسجل</span>
                        <div class="teacher-code-actions">
                            <button
                                type="button"
                                class="secondary-button teacher-action-code"
                                data-teacher-action="code"
                                data-teacher-id="${escapeHTML(teacher.id)}">
                                عرض / نسخ الكود
                            </button>
                        </div>
                    </td>

                    <td>
                        <div class="teacher-actions">
                            <button
                                type="button"
                                class="secondary-button teacher-action-edit"
                                data-teacher-action="edit"
                                data-teacher-id="${escapeHTML(teacher.id)}">
                                تعديل
                            </button>

                            <button
                                type="button"
                                class="danger-button teacher-action-delete"
                                data-teacher-action="delete"
                                data-teacher-id="${escapeHTML(teacher.id)}">
                                حذف
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function friendlyError(error) {
        const message = String(error?.message || "");

        if (
            /permission denied|row-level security|42501/i.test(message)
        ) {
            return "رفضت صلاحيات قاعدة البيانات قراءة بعض البيانات. لم نغيّر الصلاحيات تلقائيًا.";
        }

        if (
            /Failed to fetch|NetworkError|fetch|timeout|timed out/i.test(message)
        ) {
            return "تعذر الاتصال بـ Supabase حاليًا. قد تكون المشكلة مؤقتة؛ أعد المحاولة لاحقًا.";
        }

        return message ||
            "حدث خطأ غير متوقع أثناء تحميل حسابات المعلمين.";
    }

    async function loadTeachers() {
        const client = window.supabaseClient;

        if (!client) {
            setMessage(
                "لم يتم العثور على اتصال Supabase. تحقق من تحميل supabase-config.js بعد مكتبة Supabase.",
                "error"
            );

            renderEmpty("تعذر الاتصال بقاعدة البيانات");
            return;
        }

        const refreshButton = $("refreshTeachers");
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.textContent = "جارٍ التحديث...";
        }

        setMessage("جارٍ تحميل حسابات المعلمين...", "info");

        try {
            const {
                data: userData,
                error: userError
            } = await client.auth.getUser();

            if (userError) throw userError;

            const user = userData?.user;

            if (!user) {
                setMessage(
                    "انتهت جلسة الدخول أو لم يتم تسجيل الدخول. سجّل الدخول بحساب مدير المدرسة ثم افتح الصفحة مجددًا.",
                    "error"
                );

                renderEmpty("يلزم تسجيل الدخول");
                return;
            }

            const {
                data: adminMemberships,
                error: adminMembershipError
            } = await client
                .from("school_memberships")
                .select("school_id, role")
                .eq("profile_id", user.id)
                .eq("role", "school_admin");

            if (adminMembershipError) throw adminMembershipError;

            if (!adminMemberships?.length) {
                setMessage(
                    "هذا الحساب ليس مرتبطًا بدور مدير المدرسة. افتح الصفحة بحساب مدير المدرسة.",
                    "error"
                );

                renderEmpty("لا توجد عضوية مدير مدرسة");
                return;
            }

            if (adminMemberships.length !== 1) {
                setMessage(
                    "هذا الحساب مرتبط بأكثر من مدرسة أو أن العضويات مكررة. أوقفنا التحميل لتجنب خلط البيانات.",
                    "error"
                );

                renderEmpty("تعذر تحديد المدرسة");
                return;
            }

            activeSchoolId = adminMemberships[0].school_id;

            const {
                data: school,
                error: schoolError
            } = await client
                .from("schools")
                .select("id, name")
                .eq("id", activeSchoolId)
                .maybeSingle();

            if (schoolError) throw schoolError;

            activeSchoolName = school?.name || "";

            const schoolNameElement = $("schoolName");
            if (schoolNameElement) {
                schoolNameElement.textContent = activeSchoolName || "مدرستي";
            }

            const schoolNameInput = $("newTeacherSchoolName");
            if (schoolNameInput && !schoolNameInput.value.trim()) {
                schoolNameInput.value = activeSchoolName;
            }

            const {
                data: schoolClassRows,
                error: schoolClassesError
            } = await client
                .from("classes")
                .select("id, school_id, stage, grade_name, gender, section_name, name")
                .eq("school_id", activeSchoolId);

            if (schoolClassesError) throw schoolClassesError;

            schoolClasses = schoolClassRows || [];

            const {
                data: teacherMemberships,
                error: teacherMembershipError
            } = await client
                .from("school_memberships")
                .select("profile_id")
                .eq("school_id", activeSchoolId)
                .eq("role", "teacher");

            if (teacherMembershipError) throw teacherMembershipError;

            const teacherIds = unique(
                (teacherMemberships || [])
                    .map((item) => item.profile_id)
                    .filter(Boolean)
                    .map(String)
            );

            if (!teacherIds.length) {
                teachers = [];
                renderTeachers();

                setMessage(
                    `لا توجد عضويات معلمين مسجلة في مدرسة ${school?.name || "مدرستك"} حتى الآن.`,
                    "success"
                );

                return;
            }

            const {
                data: profileRows,
                error: profilesError
            } = await client
                .from("profiles")
                .select("id, full_name, phone, role, created_at")
                .in("id", teacherIds)
                .eq("role", "teacher")
                .order("created_at", { ascending: false });

            if (profilesError) throw profilesError;

            const {
                data: assignments,
                error: assignmentsError
            } = await client
                .from("teacher_assignments")
                .select("teacher_profile_id, school_id, class_id, subject")
                .eq("school_id", activeSchoolId)
                .in("teacher_profile_id", teacherIds);

            if (assignmentsError) throw assignmentsError;

            const classMap = new Map(
                schoolClasses.map(
                    (item) => [String(item.id), item]
                )
            );

            const assignmentMap = new Map();

            for (const item of (assignments || [])) {
                const key = String(item.teacher_profile_id);
                const schoolClass = classMap.get(String(item.class_id));

                if (!assignmentMap.has(key)) {
                    assignmentMap.set(key, []);
                }

                assignmentMap.get(key).push({
                    classId: item.class_id,
                    subject: item.subject || "غير محددة",
                    stage: schoolClass?.stage || "",
                    grade: schoolClass?.grade_name ||
                        schoolClass?.name || "",
                    section: schoolClass?.section_name || "",
                    gender: schoolClass?.gender || "",
                    classKey: [
                        schoolClass?.stage || "",
                        schoolClass?.grade_name ||
                            schoolClass?.name || "",
                        schoolClass?.section_name || ""
                    ].join("|")
                });
            }

            teachers = (profileRows || [])
                .filter((profile) =>
                    teacherIds.includes(String(profile.id))
                )
                .map((profile) => ({
                    id: profile.id,
                    name: profile.full_name || "اسم غير متوفر",
                    phone: profile.phone || "",
                    createdAt: profile.created_at,
                    assignments:
                        assignmentMap.get(String(profile.id)) || []
                }));

            renderTeachers();

            setMessage(
                `تم تحميل بيانات ${teachers.length} معلم من مدرسة ${school?.name || "مدرستك"}.`,
                "success"
            );
        } catch (error) {
            console.error("Teacher accounts load failed:", error);

            setMessage(friendlyError(error), "error");

            renderEmpty(
                "تعذر تحميل حسابات المعلمين",
                "أعد المحاولة لاحقًا. إذا استمر الخطأ فسنراجع تفاصيله قبل تغيير الصلاحيات."
            );
        } finally {
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = "<span>↻</span> تحديث القائمة";
            }
        }
    }

    function setModalStatus(elementId, message, type = "info") {
        const element = $(elementId);
        if (!element) return;

        element.textContent = message;
        element.className = `modal-status show ${type}`;
    }

    function openModal(modalId) {
        if (window.ILABRATTeacherModals?.open) {
            window.ILABRATTeacherModals.open(modalId);
            return;
        }

        const modal = $(modalId);
        if (!modal) return;

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    function closeModal(modalId) {
        if (window.ILABRATTeacherModals?.close) {
            window.ILABRATTeacherModals.close(modalId);
            return;
        }

        const modal = $(modalId);
        if (!modal) return;

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    function findTeacher(id) {
        return teachers.find(
            (teacher) => String(teacher.id) === String(id)
        );
    }

    async function invokeTeacherAction(action, payload) {
        const client = window.supabaseClient;

        if (!client) {
            throw new Error("اتصال Supabase غير متاح.");
        }

        const { data, error } = await client.functions.invoke(
            "teacher-handler",
            {
                body: { action, ...payload }
            }
        );

        if (error) {
            let detail = error.message || "تعذر تنفيذ العملية على الخادم.";

            try {
                if (
                    error.context &&
                    typeof error.context.json === "function"
                ) {
                    const responseBody = await error.context.json();

                    if (responseBody?.error) {
                        detail = responseBody.error;
                    }
                }
            } catch (_) {}

            throw new Error(detail);
        }

        if (!data?.success) {
            throw new Error(data?.error || "لم تكتمل العملية.");
        }

        return data;
    }

    /*
     * إنشاء محرر تكليفات مستقل داخل نافذة التعديل.
     */
    function ensureEditAssignmentEditor() {
        const form = $("editTeacherForm");

        if (!form) {
            throw new Error("لم يتم العثور على نموذج تعديل المعلم.");
        }

        let section = $("editTeacherAssignmentsSection");

        if (section) return section;

        section = document.createElement("section");
        section.id = "editTeacherAssignmentsSection";
        section.className = "edit-teacher-assignments";
        section.style.cssText =
            "margin:18px 0;padding:16px;border:1px solid #e6d9d5;border-radius:12px;background:#fffdfb";

        section.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
                <strong>تكليفات المعلم</strong>
                <button
                    type="button"
                    class="secondary-button"
                    id="addEditTeacherAssignmentButton">
                    + إضافة تكليف
                </button>
            </div>

            <div id="editTeacherAssignmentsContainer"></div>
        `;

        const status = $("editTeacherStatusMessage");

        if (status) {
            form.insertBefore(section, status);
        } else {
            form.appendChild(section);
        }

        $("addEditTeacherAssignmentButton").addEventListener(
            "click",
            () => createEditAssignmentRow()
        );

        return section;
    }

    /*
     * إنشاء صف تكليف في نافذة تعديل المعلم.
     * التكليف القديم يحمل بياناته الأصلية حتى نعرف إن طلب المستخدم حذفه.
     */
    function createEditAssignmentRow(
        classId = "",
        subject = "",
        isExisting = false
    ) {
        const container = $("editTeacherAssignmentsContainer");
        if (!container) return;

        const row = document.createElement("div");
        row.className =
            "teacher-assignment-row edit-teacher-assignment-row";

        row.dataset.existing = String(isExisting);
        row.dataset.originalClassId = String(classId);
        row.dataset.originalSubject = subject;

        row.style.cssText =
            "display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;margin-bottom:12px";

        const options = schoolClasses.map((item) => {
            const selected =
                String(item.id) === String(classId) ? " selected" : "";

            return `
                <option value="${escapeHTML(item.id)}"${selected}>
                    ${escapeHTML(classLabel(item))}
                </option>
            `;
        }).join("");

        row.innerHTML = `
            <div class="form-field">
                <label>الشعبة *</label>
                <select class="edit-assignment-class" required>
                    <option value="">اختر الشعبة</option>
                    ${options}
                </select>
            </div>

            <div class="form-field">
                <label>المادة *</label>
                <input
                    class="edit-assignment-subject"
                    type="text"
                    required
                    maxlength="150"
                    value="${escapeHTML(subject)}"
                    placeholder="مثال: الرياضيات">
            </div>

            <div class="form-field">
                <button
                    type="button"
                    class="secondary-button edit-assignment-remove">
                    إزالة
                </button>
            </div>
        `;

        row.querySelector(".edit-assignment-remove")
            .addEventListener("click", () => {
                if (row.dataset.existing === "true") {
                    removedEditAssignments.push({
                        class_id: Number(row.dataset.originalClassId),
                        subject: row.dataset.originalSubject
                    });
                }

                row.remove();
            });

        container.appendChild(row);
    }

    /*
     * تحميل بيانات المعلم وتكليفاته الحالية عند فتح نافذة التعديل.
     */
    function openEditTeacher(teacher) {
        $("editTeacherId").value = teacher.id;

        $("editTeacherName").value =
            teacher.name === "اسم غير متوفر" ? "" : teacher.name;

        $("editTeacherPhone").value = teacher.phone || "";

        try {
            ensureEditAssignmentEditor();

            // تصفير طلبات الحذف السابقة عند فتح معلم جديد.
            removedEditAssignments = [];

            const container = $("editTeacherAssignmentsContainer");
            container.innerHTML = "";

            const currentAssignments =
                Array.isArray(teacher.assignments)
                    ? teacher.assignments
                    : [];

            if (currentAssignments.length) {
                currentAssignments.forEach((assignment) => {
                    createEditAssignmentRow(
                        assignment.classId,
                        assignment.subject === "غير محددة"
                            ? ""
                            : assignment.subject,
                        true
                    );
                });
            } else {
                createEditAssignmentRow();
            }

            setModalStatus(
                "editTeacherStatusMessage",
                "تم تحميل بيانات المعلم وتكليفاته الحالية. يمكنك إضافة تكليفات أو إزالة القديمة.",
                "info"
            );

            openModal("editTeacherModal");
        } catch (error) {
            console.error(
                "Could not prepare teacher edit form:",
                error
            );

            setModalStatus(
                "editTeacherStatusMessage",
                error.message || "تعذر تجهيز خانات التعديل.",
                "error"
            );

            openModal("editTeacherModal");
        }
    }

    function openDeleteTeacher(teacher) {
        $("deleteTeacherId").value = teacher.id;
        $("deleteTeacherName").value = teacher.name;

        setModalStatus("deleteTeacherStatus", "", "info");
        openModal("deleteTeacherModal");
    }

    function classLabel(item) {
        return [
            item.stage,
            item.grade_name || item.name,
            item.gender,
            item.section_name
                ? `شعبة ${item.section_name}`
                : ""
        ].filter(Boolean).join(" — ");
    }

    /*
     * إضافة صف تكليف في نافذة إنشاء الحساب.
     */
    function addAssignmentRow() {
        const container = $("teacherAssignmentsContainer");
        if (!container) return;

        const row = document.createElement("div");
        row.className = "teacher-assignment-row modal-form-grid";
        row.style.marginBottom = "10px";

        const options = schoolClasses.map((item) =>
            `<option value="${escapeHTML(item.id)}">${escapeHTML(classLabel(item))}</option>`
        ).join("");

        row.innerHTML = `
            <div class="form-field">
                <label>الشعبة *</label>
                <select class="teacher-assignment-class" required>
                    <option value="">اختر الشعبة</option>
                    ${options}
                </select>
            </div>

            <div class="form-field">
                <label>المادة *</label>
                <input
                    class="teacher-assignment-subject"
                    type="text"
                    required
                    maxlength="150"
                    placeholder="مثال: الرياضيات">
            </div>

            <div class="form-field full-width">
                <button
                    class="secondary-button teacher-assignment-remove"
                    type="button">
                    إزالة هذا التكليف
                </button>
            </div>
        `;

        row.querySelector(".teacher-assignment-remove")
            .addEventListener("click", () => {
                const rows = container.querySelectorAll(
                    ".teacher-assignment-row"
                );

                if (rows.length <= 1) {
                    row.querySelector(".teacher-assignment-class").value = "";
                    row.querySelector(".teacher-assignment-subject").value = "";
                    return;
                }

                row.remove();
            });

        container.appendChild(row);
    }

    async function createTeacher(event) {
        event.preventDefault();

        const form = $("createTeacherForm");
        const button = form.querySelector('button[type="submit"]');

        const schoolName = $("newTeacherSchoolName")
            .value.trim().replace(/\s+/g, " ");

        const fullName = $("newTeacherName")
            .value.trim().replace(/\s+/g, " ");

        const phone = $("newTeacherPhone").value.trim();

        const assignmentRows = [
            ...document.querySelectorAll(
                "#teacherAssignmentsContainer .teacher-assignment-row"
            )
        ];

        const assignments = assignmentRows.map((row) => ({
            class_id: Number(
                row.querySelector(".teacher-assignment-class").value
            ),
            subject: row.querySelector(
                ".teacher-assignment-subject"
            ).value.trim()
        }));

        if (!activeSchoolId || !activeSchoolName) {
            setModalStatus(
                "createTeacherStatus",
                "تعذر تحديد المدرسة المرتبطة بحسابك. حدّث الصفحة وحاول مجددًا.",
                "error"
            );
            return;
        }

        if (
            !schoolName ||
            schoolName.toLocaleLowerCase("ar") !==
            activeSchoolName.trim()
                .replace(/\s+/g, " ")
                .toLocaleLowerCase("ar")
        ) {
            setModalStatus(
                "createTeacherStatus",
                "اسم المدرسة لا يطابق المدرسة المرتبطة بحسابك. تحقق من الاسم وحاول مجددًا.",
                "error"
            );
            return;
        }

        if (fullName.split(" ").filter(Boolean).length < 4) {
            setModalStatus(
                "createTeacherStatus",
                "أدخل الاسم الرباعي للمعلم.",
                "error"
            );
            return;
        }

        if (!phone || phone.length > 30) {
            setModalStatus(
                "createTeacherStatus",
                "أدخل رقم هاتف صحيحًا لا يتجاوز 30 حرفًا.",
                "error"
            );
            return;
        }

        if (
            !assignments.length ||
            assignments.some((item) =>
                !item.class_id ||
                !item.subject ||
                item.subject.length > 150
            )
        ) {
            setModalStatus(
                "createTeacherStatus",
                "أكمل اختيار الشعبة واسم المادة لكل تكليف.",
                "error"
            );
            return;
        }

        button.disabled = true;
        button.textContent = "جارٍ إنشاء الحساب...";

        setModalStatus(
            "createTeacherStatus",
            "جارٍ التحقق من المدرسة وإنشاء الحساب...",
            "info"
        );

        try {
            const data = await invokeTeacherAction("create", {
                school_id: activeSchoolId,
                school_name: schoolName,
                full_name: fullName,
                phone,
                assignments
            });

            setModalStatus(
                "createTeacherStatus",
                `تم إنشاء الحساب بنجاح. كود الدخول: ${data.login_code || "غير متاح"} — احفظ الكود قبل إغلاق النافذة.`,
                "success"
            );

            showToast("تم إنشاء حساب المعلم.");

            await loadTeachers();

            form.reset();

            $("newTeacherSchoolName").value = activeSchoolName;
            $("teacherAssignmentsContainer").innerHTML = "";

            addAssignmentRow();
        } catch (error) {
            console.error("Teacher creation failed:", error);

            setModalStatus(
                "createTeacherStatus",
                friendlyError(error),
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = "إنشاء الحساب";
        }
    }

    async function retrieveTeacherCode(teacher, button) {
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "جارٍ الاسترجاع...";

        try {
            const data = await invokeTeacherAction(
                "get_code",
                { teacher_id: teacher.id }
            );

            const code = String(data.login_code || "").trim();

            if (!code) {
                throw new Error(
                    "لم يُعثر على كود محفوظ لهذا الحساب. قد يكون الحساب أُنشئ قبل تفعيل حفظ الأكواد."
                );
            }

            let copied = false;

            try {
                await navigator.clipboard.writeText(code);
                copied = true;
            } catch (_) {}

            window.prompt(
                copied
                    ? "تم نسخ الكود. يمكنك الاحتفاظ بهذه النافذة للمراجعة:"
                    : "انسخ كود الدخول واحفظه بأمان:",
                code
            );

            showToast(
                copied
                    ? "تم استرجاع الكود ونسخه."
                    : "تم استرجاع الكود."
            );
        } catch (error) {
            showToast(friendlyError(error));
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    /*
     * حفظ بيانات المعلم.
     * التكليفات القديمة تبقى كما هي ما لم يطلب المستخدم حذفها.
     * التكليفات الجديدة ترسل للإضافة فقط.
     */
    async function saveTeacherEdits(event) {
        event.preventDefault();

        const form = $("editTeacherForm");
        const button = form.querySelector('button[type="submit"]');

        const teacherId = $("editTeacherId").value;

        const fullName = $("editTeacherName")
            .value.trim().replace(/\s+/g, " ");

        const phone = $("editTeacherPhone").value.trim();

        const rows = [
            ...document.querySelectorAll(
                "#editTeacherAssignmentsContainer .edit-teacher-assignment-row"
            )
        ];

        const assignments = [];
        const removedAssignments = [...removedEditAssignments];

        for (const row of rows) {
            const classId = Number(
                row.querySelector(".edit-assignment-class").value
            );

            const subject = row.querySelector(
                ".edit-assignment-subject"
            ).value.trim();

            if (!classId || !subject || subject.length > 150) {
                setModalStatus(
                    "editTeacherStatusMessage",
                    "أكمل اختيار الشعبة واسم المادة لكل تكليف.",
                    "error"
                );
                return;
            }

            const isExisting = row.dataset.existing === "true";

            const originalClassId = Number(
                row.dataset.originalClassId
            );

            const originalSubject =
                row.dataset.originalSubject || "";

            const unchanged =
                isExisting &&
                classId === originalClassId &&
                subject === originalSubject;

            // التكليف القديم الذي لم يتغير لا نرسله للإضافة أو الحذف.
            if (unchanged) {
                continue;
            }

            // إذا عُدّل تكليف قديم، نحذف نسخته القديمة ونضيف الجديدة.
            if (isExisting) {
                removedAssignments.push({
                    class_id: originalClassId,
                    subject: originalSubject
                });
            }

            assignments.push({
                class_id: classId,
                subject
            });
        }

        if (
            !teacherId ||
            fullName.split(" ").filter(Boolean).length < 2
        ) {
            setModalStatus(
                "editTeacherStatusMessage",
                "أدخل اسم المعلم الكامل (كلمتين على الأقل).",
                "error"
            );
            return;
        }

        if (phone.length > 30) {
            setModalStatus(
                "editTeacherStatusMessage",
                "رقم الهاتف طويل جدًا.",
                "error"
            );
            return;
        }

        // منع تكرار الشعبة والمادة في الصفوف الظاهرة.
        const visibleKeys = rows.map((row) => {
            const classId = Number(
                row.querySelector(".edit-assignment-class").value
            );

            const subject = row.querySelector(
                ".edit-assignment-subject"
            ).value.trim();

            return `${classId}|${subject.toLocaleLowerCase("ar")}`;
        });

        if (new Set(visibleKeys).size !== visibleKeys.length) {
            setModalStatus(
                "editTeacherStatusMessage",
                "يوجد تكليف مكرر للشعبة والمادة نفسيهما.",
                "error"
            );
            return;
        }

        // منع إرسال تكليف جديد موجود أصلًا ضمن التكليفات القديمة غير المحذوفة.
        const teacher = findTeacher(teacherId);

        const existingKeys = new Set(
            (teacher?.assignments || [])
                .filter((item) => {
                    const isRemoved = removedAssignments.some(
                        (removed) =>
                            Number(removed.class_id) === Number(item.classId) &&
                            removed.subject === item.subject
                    );

                    return !isRemoved;
                })
                .map((item) =>
                    `${Number(item.classId)}|${String(item.subject).toLocaleLowerCase("ar")}`
                )
        );

        const duplicateNewAssignment = assignments.some((item) =>
            existingKeys.has(
                `${Number(item.class_id)}|${item.subject.toLocaleLowerCase("ar")}`
            )
        );

        if (duplicateNewAssignment) {
            setModalStatus(
                "editTeacherStatusMessage",
                "هذا التكليف موجود مسبقًا للمعلم. لا يمكن إضافته مرة أخرى.",
                "error"
            );
            return;
        }

        button.disabled = true;

        const originalText = button.textContent;
        button.textContent = "جارٍ الحفظ...";

        setModalStatus(
            "editTeacherStatusMessage",
            "جارٍ حفظ بيانات المعلم والتكليفات...",
            "info"
        );

        try {
            await invokeTeacherAction("update", {
                teacher_id: teacherId,
                school_id: activeSchoolId,
                full_name: fullName,
                phone: phone || null,

                // التكليفات الجديدة أو المعدلة فقط.
                assignments,

                // التكليفات القديمة التي طلب المستخدم حذفها.
                removed_assignments: removedAssignments
            });

            removedEditAssignments = [];

            showToast("تم إرسال تحديث بيانات المعلم وتكليفاته.");

            closeModal("editTeacherModal");

            await loadTeachers();

        } catch (error) {
            console.error("Teacher update failed:", error);

            setModalStatus(
                "editTeacherStatusMessage",
                friendlyError(error),
                "error"
            );

        } finally {
            button.disabled = false;
            button.textContent = originalText || "حفظ التعديلات";
        }
    }

    async function deleteTeacher(event) {
        event.preventDefault();

        const form = $("deleteTeacherForm");
        const button = form.querySelector('button[type="submit"]');
        const teacherId = $("deleteTeacherId").value;

        if (!teacherId) {
            setModalStatus(
                "deleteTeacherStatus",
                "لم يتم تحديد حساب المعلم.",
                "error"
            );
            return;
        }

        button.disabled = true;
        button.textContent = "جارٍ الحذف...";

        setModalStatus(
            "deleteTeacherStatus",
            "جارٍ حذف الحساب وبياناته المرتبطة...",
            "info"
        );

        try {
            await invokeTeacherAction("delete", {
                teacher_id: teacherId,
                school_id: activeSchoolId
            });

            showToast("تم حذف حساب المعلم.");

            closeModal("deleteTeacherModal");

            await loadTeachers();
        } catch (error) {
            console.error("Teacher deletion failed:", error);

            setModalStatus(
                "deleteTeacherStatus",
                friendlyError(error),
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = "متابعة الحذف";
        }
    }

    function clearFilters() {
        if ($("teacherSearch")) $("teacherSearch").value = "";
        if ($("subjectFilter")) $("subjectFilter").value = "";
        if ($("stageFilter")) $("stageFilter").value = "";

        renderTeachers();
    }

    async function logout(event) {
        event.preventDefault();

        if (!window.supabaseClient) {
            window.location.href = "index.html";
            return;
        }

        const { error } =
            await window.supabaseClient.auth.signOut();

        if (error) {
            console.error("Sign out failed:", error);

            setMessage(
                "تعذر تسجيل الخروج. حاول مرة أخرى.",
                "error"
            );

            return;
        }

        window.location.href = "index.html";
    }

    function init() {
        $("refreshTeachers")?.addEventListener(
            "click",
            loadTeachers
        );

        $("teacherSearch")?.addEventListener(
            "input",
            renderTeachers
        );

        $("subjectFilter")?.addEventListener(
            "change",
            renderTeachers
        );

        $("stageFilter")?.addEventListener(
            "change",
            renderTeachers
        );

        $("clearSearch")?.addEventListener(
            "click",
            clearFilters
        );

        $("logoutLink")?.addEventListener(
            "click",
            logout
        );

        $("teachersTableBody")?.addEventListener(
            "click",
            (event) => {
                const button = event.target.closest(
                    "[data-teacher-action]"
                );

                if (!button) return;

                const teacher = findTeacher(
                    button.dataset.teacherId
                );

                if (!teacher) {
                    showToast(
                        "تعذر العثور على بيانات المعلم. حدّث القائمة وحاول مجددًا."
                    );
                    return;
                }

                if (button.dataset.teacherAction === "edit") {
                    openEditTeacher(teacher);
                }

                if (button.dataset.teacherAction === "delete") {
                    openDeleteTeacher(teacher);
                }

                if (button.dataset.teacherAction === "code") {
                    retrieveTeacherCode(teacher, button);
                }
            }
        );

        $("createTeacherForm")?.addEventListener(
            "submit",
            createTeacher
        );

        $("addTeacherAssignmentButton")?.addEventListener(
            "click",
            addAssignmentRow
        );

        $("editTeacherForm")?.addEventListener(
            "submit",
            saveTeacherEdits
        );

        $("deleteTeacherForm")?.addEventListener(
            "submit",
            deleteTeacher
        );
        // ربط أزرار X وإلغاء بإغلاق النافذة المناسبة.
        document.querySelectorAll("[data-close-modal]").forEach((button) => {
            button.addEventListener("click", () => {
                const modal = button.closest(".modal-overlay");

                if (modal?.id) {
                    closeModal(modal.id);
                }
            });
        });

        // إغلاق النافذة عند الضغط على الخلفية خارج مربع الحوار.
        document.querySelectorAll(".modal-overlay").forEach((modal) => {
            modal.addEventListener("click", (event) => {
                if (event.target === modal) {
                    closeModal(modal.id);
                }
            });
        });
        loadTeachers().then(() => {
            const container = $("teacherAssignmentsContainer");

            if (container && !container.children.length) {
                addAssignmentRow();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", init);
})();
