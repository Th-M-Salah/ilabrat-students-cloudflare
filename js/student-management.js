"use strict";

/* =========================================================
   ILABRAT — STUDENT MANAGEMENT
   إدارة طلاب المدرسة

   الوظائف الأساسية:
   - تحميل بيانات المدرسة والشعب والطلاب
   - عرض اسم الطالب واسم المستخدم ورمز الدخول
   - نسخ رمز الدخول
   - البحث والتصفية والإحصائيات
   - تعديل اسم الطالب واسم الدخول والصف والشعبة
   - حذف الطالب بعد التأكيد
   - التحقق من جلسة Supabase
   - الحفاظ على البيانات السابقة عند فشل التحميل
   ========================================================= */

(() => {
    const FUNCTION_NAME = "student-management-handler";

    const state = {
        db: null,
        school: null,
        classes: [],
        students: [],

        selectedStudent: null,
        pendingDeleteStudent: null,
        editingStudent: null,

        loading: false,
        deleting: false,
        saving: false
    };

    const $ = (id) => document.getElementById(id);

    const el = {
        schoolName: $("studentSchoolName"),
        schoolDetails: $("studentSchoolDetails"),
        connectionNotice: $("connectionNotice"),

        adminName: $("adminDisplayName"),
        adminAvatar: $("adminProfileAvatar"),
        sidebarSchoolName: $("schoolDisplayName"),

        totalSchoolStudents: $("totalSchoolStudents"),
        totalClassStudents: $("totalClassStudents"),
        totalSectionStudents: $("totalSectionStudents"),
        visibleStudentCount: $("visibleStudentCount"),

        gradeFilter: $("studentGradeFilter"),
        sectionFilter: $("studentSectionFilter"),
        search: $("studentSearch"),

        refreshButton: $("refreshStudentsButton"),
        clearFiltersButton: $("clearStudentFiltersButton"),

        tableBody: $("studentsTableBody"),
        listMessage: $("studentListMessage"),
        listBadge: $("studentListBadge"),
        emptyState: $("studentListEmpty"),

        /* نافذة التفاصيل */
        detailsModal: $("studentDetailsModal"),
        detailAvatar: $("studentDetailAvatar"),
        detailStudentName: $("detailStudentName"),
        detailStudentClass: $("detailStudentClass"),
        detailFullName: $("detailFullName"),
        detailUsername: $("detailUsername"),
        detailStage: $("detailStage"),
        detailGrade: $("detailGrade"),
        detailSection: $("detailSection"),
        detailStudentId: $("detailStudentId"),

        editFromDetailsButton: $("editStudentFromDetailsButton"),
        deleteFromDetailsButton: $("deleteStudentFromDetailsButton"),

        /* نافذة التعديل */
        editModal: $("studentEditModal"),
        editForm: $("studentEditForm"),
        editStudentId: $("editStudentId"),

        editAvatar: $("editStudentAvatar"),
        editCurrentName: $("editStudentCurrentName"),
        editCurrentClass: $("editStudentCurrentClass"),

        editRecordId: $("editStudentRecordId"),
        editUsernameDisplay: $("editStudentUsernameDisplay"),
        editCurrentStage: $("editStudentCurrentStage"),
        editCurrentGrade: $("editStudentCurrentGrade"),
        editCurrentSection: $("editStudentCurrentSection"),

        editFullName: $("editStudentFullName"),
        editUsername: $("editStudentUsername"),
        editClass: $("editStudentClass"),

        editMessage: $("editStudentMessage"),
        cancelEditButton: $("cancelStudentEditButton"),
        saveEditButton: $("saveStudentChangesButton"),

        /* نافذة الحذف */
        deleteModal: $("deleteStudentModal"),
        deleteStudentName: $("deleteStudentName"),
        deleteStudentClass: $("deleteStudentClass"),
        deleteStudentMessage: $("deleteStudentMessage"),
        cancelDeleteButton: $("cancelDeleteStudentButton"),
        confirmDeleteButton: $("confirmDeleteStudentButton")
    };

    /* =====================================================
       أدوات عامة
       ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function text(value, fallback = "—") {
        const result = String(value ?? "").trim();
        return result || fallback;
    }

    function normalizeId(value) {
        if (value === null || value === undefined || value === "") {
            return "";
        }

        return String(value);
    }

    function setStatus(message, type = "info") {
        if (el.listMessage) {
            el.listMessage.textContent = message;
            el.listMessage.dataset.type = type;
        }

        if (el.connectionNotice) {
            el.connectionNotice.textContent = message;
            el.connectionNotice.dataset.type = type;
        }
    }

    function setEditMessage(message, type = "info") {
        if (!el.editMessage) return;

        el.editMessage.textContent = message;
        el.editMessage.dataset.type = type;
        el.editMessage.hidden = !message;
    }

    function setDeleteMessage(message, type = "info") {
        if (!el.deleteStudentMessage) return;

        el.deleteStudentMessage.textContent = message;
        el.deleteStudentMessage.dataset.type = type;
        el.deleteStudentMessage.hidden = !message;
    }

    function setLoading(isLoading) {
        state.loading = isLoading;

        if (el.refreshButton) {
            el.refreshButton.disabled =
                isLoading || state.deleting || state.saving;

            el.refreshButton.textContent = isLoading
                ? "جارٍ التحديث..."
                : "↻ تحديث البيانات";
        }

        if (el.clearFiltersButton) {
            el.clearFiltersButton.disabled = isLoading;
        }
    }

    function setDeleting(isDeleting) {
        state.deleting = isDeleting;

        if (el.confirmDeleteButton) {
            el.confirmDeleteButton.disabled = isDeleting;

            el.confirmDeleteButton.textContent = isDeleting
                ? "جارٍ الحذف..."
                : "تأكيد الحذف نهائيًا";
        }

        if (el.cancelDeleteButton) {
            el.cancelDeleteButton.disabled = isDeleting;
        }

        if (el.refreshButton) {
            el.refreshButton.disabled =
                isDeleting || state.loading || state.saving;
        }
    }

    function setSaving(isSaving) {
        state.saving = isSaving;

        if (el.saveEditButton) {
            el.saveEditButton.disabled = isSaving;

            el.saveEditButton.textContent = isSaving
                ? "جارٍ حفظ التعديلات..."
                : "حفظ التعديلات";
        }

        if (el.cancelEditButton) {
            el.cancelEditButton.disabled = isSaving;
        }

        if (el.refreshButton) {
            el.refreshButton.disabled =
                isSaving || state.loading || state.deleting;
        }
    }

    function openModal(modal) {
        if (!modal) return;

        modal.hidden = false;
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");

        document.body.classList.add("student-modal-open");
    }

    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove("is-open");
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");

        const anyModalOpen = [
            el.detailsModal,
            el.editModal,
            el.deleteModal
        ].some((item) => item && !item.hidden);

        if (!anyModalOpen) {
            document.body.classList.remove("student-modal-open");
        }
    }

    function closeAllModals() {
        closeModal(el.detailsModal);
        closeModal(el.editModal);
        closeModal(el.deleteModal);
    }

    /* =====================================================
       بيانات الطلاب والشعب
       ===================================================== */

    function getClassForStudent(student) {
        if (!student) return null;

        const classId = normalizeId(student.class_id);

        return state.classes.find(
            (item) => normalizeId(item.id) === classId
        ) || null;
    }

    function getStudentName(student) {
        return text(
            student?.full_name ||
            student?.profile_full_name ||
            student?.login_name ||
            student?.student_number,
            "طالب دون اسم"
        );
    }

    function getStudentLogin(student) {
        return text(
            student?.login_name ||
            student?.student_number,
            "غير متوفر"
        );
    }

    /*
     * اسم الدخول الفعلي من قاعدة البيانات.
     * لا نستخدم رقم الطالب بديلًا عند إرسال التعديل.
     */
    function getActualStudentLogin(student) {
        return text(student?.login_name, "");
    }

    /*
     * لا ينشئ هذا الملف رمز دخول بديلًا.
     * يعرض الرمز الذي تعيده الدالة الخلفية المخوّلة فقط.
     */
    function getStudentCode(student) {
        const code =
            student?.login_code ??
            student?.secret_code ??
            student?.decrypted_code;

        if (code === null || code === undefined) {
            return "";
        }

        return String(code);
    }

    function getClassName(student) {
        const classInfo = getClassForStudent(student);

        if (student?.class_label) {
            return student.class_label;
        }

        if (student?.class_name) {
            return student.class_name;
        }

        if (classInfo) {
            const parts = [
                classInfo.stage,
                classInfo.grade_name,
                classInfo.gender,
                classInfo.section_name
            ].filter(Boolean);

            return parts.length
                ? parts.join(" — ")
                : text(classInfo.name);
        }

        return "الشعبة غير محددة";
    }

    function getStage(student) {
        const classInfo = getClassForStudent(student);

        return text(
            student?.stage || classInfo?.stage
        );
    }

    function getGrade(student) {
        const classInfo = getClassForStudent(student);

        return text(
            student?.grade_name || classInfo?.grade_name
        );
    }

    function getSection(student) {
        const classInfo = getClassForStudent(student);

        return text(
            student?.section_name || classInfo?.section_name
        );
    }

    function getGradeKey(classInfo) {
        return [
            text(classInfo.stage, ""),
            text(classInfo.grade_name, ""),
            text(classInfo.gender, "")
        ].join("::");
    }

    function getSelectedGradeKey() {
        return el.gradeFilter?.value || "";
    }

    function getSelectedClassId() {
        return el.sectionFilter?.value || "";
    }

    function findStudentById(id) {
        return state.students.find(
            (student) =>
                normalizeId(student.id) === normalizeId(id)
        ) || null;
    }

    /* =====================================================
       خيارات التصفية
       ===================================================== */

    function buildGradeOptions() {
        if (!el.gradeFilter) return;

        const previousValue = el.gradeFilter.value;
        const uniqueGrades = new Map();

        state.classes.forEach((classInfo) => {
            const key = getGradeKey(classInfo);

            if (!key.replace(/:/g, "").trim()) return;

            if (!uniqueGrades.has(key)) {
                const label = [
                    classInfo.stage,
                    classInfo.grade_name,
                    classInfo.gender
                ].filter(Boolean).join(" — ");

                uniqueGrades.set(
                    key,
                    label || text(classInfo.name)
                );
            }
        });

        el.gradeFilter.innerHTML =
            '<option value="">جميع الصفوف</option>' +
            Array.from(uniqueGrades.entries())
                .sort((a, b) => a[1].localeCompare(b[1], "ar"))
                .map(([key, label]) =>
                    `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`
                )
                .join("");

        if (uniqueGrades.has(previousValue)) {
            el.gradeFilter.value = previousValue;
        }
        el.gradeFilter.disabled = uniqueGrades.size === 0;
    }

    function buildSectionOptions() {
        if (!el.sectionFilter) return;

        const previousValue = el.sectionFilter.value;
        const gradeKey = getSelectedGradeKey();

        const filteredClasses = state.classes.filter((classInfo) => {
            return !gradeKey || getGradeKey(classInfo) === gradeKey;
        });

        el.sectionFilter.innerHTML =
            '<option value="">جميع الشعب</option>' +
            filteredClasses
                .slice()
                .sort((a, b) => {
                    const aName = text(a.section_name || a.name, "");
                    const bName = text(b.section_name || b.name, "");

                    return aName.localeCompare(bName, "ar");
                })
                .map((classInfo) => {
                    const sectionLabel = [
                        classInfo.section_name,
                        classInfo.gender
                    ].filter(Boolean).join(" — ");

                    const label = sectionLabel || text(classInfo.name);

                    return `
                        <option value="${escapeHTML(classInfo.id)}">
                            ${escapeHTML(label)}
                        </option>
                    `;
                })
                .join("");

        const stillExists = filteredClasses.some(
            (item) =>
                normalizeId(item.id) === normalizeId(previousValue)
        );

        if (stillExists) {
            el.sectionFilter.value = previousValue;
        }
        el.sectionFilter.disabled = filteredClasses.length === 0;
    }

    function updateSchoolInfo() {
        const schoolName = text(
            state.school?.name,
            "مدرستي"
        );

        if (el.schoolName) {
            el.schoolName.textContent = schoolName;
        }

        if (el.sidebarSchoolName) {
            el.sidebarSchoolName.textContent = schoolName;
        }

        if (el.schoolDetails) {
            el.schoolDetails.textContent = state.school
                ? `رقم المدرسة: ${text(state.school.id)}`
                : "لم يتم تحميل بيانات المدرسة";
        }
    }

    /* =====================================================
       خيارات صفوف وشعب نافذة التعديل
       ===================================================== */

    function getEditClassLabel(classInfo) {
        const parts = [
            classInfo.stage,
            classInfo.grade_name,
            classInfo.gender,
            classInfo.section_name
        ].filter(Boolean);

        return parts.length
            ? parts.join(" — ")
            : text(classInfo.name);
    }

    function buildEditClassOptions(selectedClassId) {
        if (!el.editClass) return;

        const selectedId = normalizeId(selectedClassId);

        const classes = state.classes
            .slice()
            .sort((a, b) => {
                const aLabel = getEditClassLabel(a);
                const bLabel = getEditClassLabel(b);

                return aLabel.localeCompare(bLabel, "ar");
            });

        el.editClass.innerHTML =
            '<option value="">اختر الصف والشعبة</option>' +
            classes.map((classInfo) => {
                const id = normalizeId(classInfo.id);
                const selected = id === selectedId ? "selected" : "";

                return `
                    <option value="${escapeHTML(id)}" ${selected}>
                        ${escapeHTML(getEditClassLabel(classInfo))}
                    </option>
                `;
            }).join("");
    }

    /* =====================================================
       البحث والتصفية والإحصائيات
       ===================================================== */

    function getVisibleStudents() {
        const gradeKey = getSelectedGradeKey();
        const classId = getSelectedClassId();

        const query = text(
            el.search?.value,
            ""
        ).toLocaleLowerCase("ar");

        return state.students.filter((student) => {
            const classInfo = getClassForStudent(student);

            if (
                gradeKey &&
                (!classInfo || getGradeKey(classInfo) !== gradeKey)
            ) {
                return false;
            }

            if (
                classId &&
                normalizeId(student.class_id) !== normalizeId(classId)
            ) {
                return false;
            }

            if (query) {
                const searchable = [
                    getStudentName(student),
                    getStudentLogin(student),
                    getClassName(student),
                    student.id,
                    student.profile_id,
                    student.student_number
                ]
                    .join(" ")
                    .toLocaleLowerCase("ar");

                if (!searchable.includes(query)) return false;
            }

            return true;
        });
    }

    function updateStatistics(visibleStudents) {
        const gradeKey = getSelectedGradeKey();
        const classId = getSelectedClassId();

        const gradeClasses = state.classes
            .filter(
                (item) => !gradeKey || getGradeKey(item) === gradeKey
            )
            .map((item) => normalizeId(item.id));

        const gradeStudents = state.students.filter(
            (student) =>
                gradeClasses.includes(normalizeId(student.class_id))
        );

        const sectionStudents = classId
            ? state.students.filter(
                (student) =>
                    normalizeId(student.class_id) === normalizeId(classId)
            )
            : gradeStudents;

        if (el.totalSchoolStudents) {
            el.totalSchoolStudents.textContent =
                String(state.students.length);
        }

        if (el.totalClassStudents) {
            el.totalClassStudents.textContent =
                String(gradeStudents.length);
        }

        if (el.totalSectionStudents) {
            el.totalSectionStudents.textContent =
                String(sectionStudents.length);
        }

        if (el.visibleStudentCount) {
            el.visibleStudentCount.textContent =
                String(visibleStudents.length);
        }

        if (el.listBadge) {
            el.listBadge.textContent =
                `${visibleStudents.length} طالب`;
        }

        if (el.totalClassStudents && el.selectedGradeLabel) {
            el.selectedGradeLabel.textContent = gradeKey
                ? el.gradeFilter.selectedOptions[0]?.textContent || "الصف المختار"
                : "جميع الصفوف";
        }

        if (el.totalSectionStudents && el.selectedSectionLabel) {
            el.selectedSectionLabel.textContent = classId
                ? el.sectionFilter.selectedOptions[0]?.textContent || "الشعبة المختارة"
                : "جميع الشعب";
        }
    }

    /* =====================================================
       نسخ رمز الدخول
       ===================================================== */

    async function copyStudentCode(student, button) {
        const code = getStudentCode(student);

        if (!code) {
            setStatus(
                "رمز هذا الطالب غير متوفر في البيانات المستلمة من الخادم.",
                "warning"
            );
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(code);
            } else {
                const input = document.createElement("textarea");

                input.value = code;
                input.setAttribute("readonly", "");
                input.style.position = "fixed";
                input.style.opacity = "0";

                document.body.appendChild(input);
                input.select();

                const copied = document.execCommand("copy");
                input.remove();

                if (!copied) {
                    throw new Error("تعذر نسخ الرمز تلقائيًا.");
                }
            }

            if (button) {
                const previousText = button.textContent;
                button.textContent = "تم النسخ";

                window.setTimeout(() => {
                    if (button.isConnected) {
                        button.textContent = previousText;
                    }
                }, 1500);
            }

            setStatus("تم نسخ رمز الدخول.", "success");
        } catch (error) {
            console.error("[ILABRAT Copy Student Code]", error);

            setStatus(
                "تعذر نسخ الرمز تلقائيًا. تحقق من صلاحيات الحافظة في المتصفح.",
                "error"
            );
        }
    }

    /* =====================================================
       عرض جدول الطلاب
       ===================================================== */

    function renderStudents() {
        if (!el.tableBody) return;

        const visibleStudents = getVisibleStudents();

        updateStatistics(visibleStudents);

        if (visibleStudents.length === 0) {
            el.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="student-table-empty">
                        لا يوجد طلاب مطابقون للبحث أو التصفية الحالية.
                    </td>
                </tr>
            `;

            if (el.emptyState) {
                el.emptyState.hidden = state.students.length > 0;
            }

            return;
        }

        if (el.emptyState) {
            el.emptyState.hidden = true;
        }

        el.tableBody.innerHTML = visibleStudents
            .map((student, index) => {
                const code = getStudentCode(student);

                const codeCell = code
                    ? `
                        <div class="student-code-cell">
                            <code dir="auto">${escapeHTML(code)}</code>

                            <button
                                type="button"
                                class="student-action-button"
                                data-action="copy-code"
                                data-student-id="${escapeHTML(student.id)}"
                                aria-label="نسخ رمز دخول ${escapeHTML(getStudentName(student))}">
                                نسخ
                            </button>
                        </div>
                    `
                    : `
                        <span class="student-code-unavailable">
                            غير محفوظ
                        </span>
                    `;

                return `
                    <tr>
                        <td>${index + 1}</td>

                        <td>
                            <div class="student-name-cell">
                                <strong>
                                    ${escapeHTML(getStudentName(student))}
                                </strong>
                            </div>
                        </td>

                        <td>
                            <span dir="auto">
                                ${escapeHTML(getStudentLogin(student))}
                            </span>
                        </td>

                        <td>${codeCell}</td>

                        <td>${escapeHTML(getClassName(student))}</td>

                        <td>
                            <div class="student-row-actions">

                                <button
                                    type="button"
                                    class="student-action-button student-action-edit"
                                    data-action="edit"
                                    data-student-id="${escapeHTML(student.id)}">
                                    تعديل
                                </button>

                                <button
                                    type="button"
                                    class="student-action-button student-action-delete"
                                    data-action="delete"
                                    data-student-id="${escapeHTML(student.id)}">
                                    حذف
                                </button>

                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    /* =====================================================
       تفاصيل الطالب
       ===================================================== */

    function showStudentDetails(student) {
        if (!student) return;

        state.selectedStudent = student;

        if (el.detailAvatar) {
            el.detailAvatar.textContent =
                getStudentName(student).charAt(0) || "ط";
        }

        if (el.detailStudentName) {
            el.detailStudentName.textContent = getStudentName(student);
        }

        if (el.detailStudentClass) {
            el.detailStudentClass.textContent = getClassName(student);
        }

        if (el.detailFullName) {
            el.detailFullName.textContent = getStudentName(student);
        }

        if (el.detailUsername) {
            el.detailUsername.textContent = getStudentLogin(student);
        }

        if (el.detailStage) {
            el.detailStage.textContent = getStage(student);
        }

        if (el.detailGrade) {
            el.detailGrade.textContent = getGrade(student);
        }

        if (el.detailSection) {
            el.detailSection.textContent = getSection(student);
        }

        if (el.detailStudentId) {
            el.detailStudentId.textContent = text(student.id);
        }

        openModal(el.detailsModal);
    }

    /* =====================================================
       فتح نافذة تعديل بيانات الطالب
       ===================================================== */

    function openEditStudent(student) {
        if (!student || state.saving) return;

        state.editingStudent = student;

        if (el.editStudentId) {
            el.editStudentId.value = student.id;
        }

        const studentName = getStudentName(student);
        const studentLogin = getStudentLogin(student);
        const actualStudentLogin = getActualStudentLogin(student);

        if (el.editAvatar) {
            el.editAvatar.textContent =
                studentName.charAt(0) || "ط";
        }

        if (el.editCurrentName) {
            el.editCurrentName.textContent = studentName;
        }

        if (el.editCurrentClass) {
            el.editCurrentClass.textContent = getClassName(student);
        }

        if (el.editRecordId) {
            el.editRecordId.textContent = text(student.id);
        }

        if (el.editUsernameDisplay) {
            el.editUsernameDisplay.textContent = studentLogin;
        }

        if (el.editCurrentStage) {
            el.editCurrentStage.textContent = getStage(student);
        }

        if (el.editCurrentGrade) {
            el.editCurrentGrade.textContent = getGrade(student);
        }

        if (el.editCurrentSection) {
            el.editCurrentSection.textContent = getSection(student);
        }

        if (el.editFullName) {
            el.editFullName.value = studentName === "طالب دون اسم"
                ? ""
                : studentName;
        }

        /*
         * نملأ حقل التعديل باسم الدخول الفعلي فقط.
         * لا نستخدم student_number كبديل لاسم الدخول.
         */
        if (el.editUsername) {
            el.editUsername.value = actualStudentLogin;
        }

        buildEditClassOptions(student.class_id);

        setEditMessage("", "info");

        if (el.saveEditButton) {
            el.saveEditButton.disabled = false;
            el.saveEditButton.textContent = "حفظ التعديلات";
        }

        if (el.cancelEditButton) {
            el.cancelEditButton.disabled = false;
        }

        closeModal(el.detailsModal);
        openModal(el.editModal);

        window.setTimeout(() => {
            el.editFullName?.focus();
        }, 100);
    }

    /* =====================================================
       التحقق من بيانات التعديل
       ===================================================== */

    function validateEditForm() {
        const studentId = text(el.editStudentId?.value, "");
        const fullName = text(el.editFullName?.value, "");
        const loginName = text(el.editUsername?.value, "");
        const classId = text(el.editClass?.value, "");

        if (!studentId) {
            throw new Error("تعذر تحديد سجل الطالب المراد تعديله.");
        }

        if (fullName.length < 2) {
            throw new Error("يرجى إدخال اسم الطالب كاملًا، وبحرفين على الأقل.");
        }

        if (fullName.length > 120) {
            throw new Error("اسم الطالب طويل جدًا. الحد الأقصى 120 حرفًا.");
        }

        if (!loginName) {
            throw new Error("يرجى إدخال اسم الدخول للطالب.");
        }

        if (loginName.length > 100) {
            throw new Error("اسم الدخول طويل جدًا. الحد الأقصى 100 حرف.");
        }

        if (!classId) {
            throw new Error("يرجى اختيار الصف والشعبة.");
        }

        const selectedClass = state.classes.find(
            (item) => normalizeId(item.id) === normalizeId(classId)
        );

        if (!selectedClass) {
            throw new Error("الصف أو الشعبة المختارة غير موجودة ضمن مدرسة الحساب.");
        }

        return {
            student_id: studentId,
            full_name: fullName,
            login_name: loginName,
            class_id: Number(classId)
        };
    }

    /* =====================================================
       حفظ تعديلات الطالب في Supabase
       ===================================================== */

    async function saveStudentChanges(event) {
        event?.preventDefault();

        if (state.saving || !state.editingStudent) return;

        let payload;

        try {
            payload = validateEditForm();
        } catch (error) {
            setEditMessage(error.message, "error");
            return;
        }

        setSaving(true);
        setEditMessage("جارٍ حفظ تعديلات الطالب...", "info");

        try {
            const data = await callManagementFunction({
                action: "update",
                student_id: payload.student_id,
                full_name: payload.full_name,
                login_name: payload.login_name,
                class_id: payload.class_id
            });

            /*
             * تحديث النسخة المحلية من بيانات الطالب
             * إذا أعادت الدالة سجل الطالب بعد التعديل.
             */
            const returnedStudent = data.student;

            if (returnedStudent) {
                const index = state.students.findIndex(
                    (item) =>
                        normalizeId(item.id) ===
                        normalizeId(payload.student_id)
                );

                if (index !== -1) {
                    state.students[index] = {
                        ...state.students[index],
                        ...returnedStudent
                    };
                }
            } else {
                /*
                 * إذا لم تُعد الدالة سجل الطالب،
                 * نحدّث الاسم واسم الدخول والصف محليًا.
                 */
                const index = state.students.findIndex(
                    (item) =>
                        normalizeId(item.id) ===
                        normalizeId(payload.student_id)
                );

                if (index !== -1) {
                    state.students[index].full_name = payload.full_name;
                    state.students[index].login_name = payload.login_name;
                    state.students[index].class_id = payload.class_id;
                }
            }

            const updatedStudent = findStudentById(payload.student_id);

            state.editingStudent = null;

            closeModal(el.editModal);

            if (updatedStudent) {
                state.selectedStudent = updatedStudent;
            }

            renderStudents();

            setStatus(
                data.message || "تم حفظ تعديلات الطالب بنجاح.",
                "success"
            );

            /*
             * إعادة تحميل بيانات المدرسة والطلاب من الخادم
             * للتأكد من تطابق القائمة مع قاعدة البيانات.
             */
            await loadStudents({ silent: true });

            setStatus(
                data.message || "تم حفظ تعديلات الطالب وتحديث القائمة بنجاح.",
                "success"
            );

        } catch (error) {
            console.error("[ILABRAT Student Update]", error);

            setEditMessage(
                error?.message ||
                "تعذر حفظ تعديلات الطالب. لم يتم تأكيد نجاح العملية.",
                "error"
            );

        } finally {
            setSaving(false);
        }
    }

    /* =====================================================
       تأكيد حذف الطالب
       ===================================================== */

    function openDeleteConfirmation(student) {
        if (!student || state.deleting) return;

        state.pendingDeleteStudent = student;

        if (el.deleteStudentName) {
            el.deleteStudentName.textContent = getStudentName(student);
        }

        if (el.deleteStudentClass) {
            el.deleteStudentClass.textContent = getClassName(student);
        }

        setDeleteMessage(
            "سيتم حذف حساب الطالب وبياناته. لا يمكن التراجع عن هذا الإجراء.",
            "warning"
        );

        if (el.confirmDeleteButton) {
            el.confirmDeleteButton.disabled = false;
            el.confirmDeleteButton.textContent = "تأكيد الحذف نهائيًا";
        }

        openModal(el.deleteModal);
    }

    /* =====================================================
       معالجة أخطاء الاتصال والدالة الخلفية
       ===================================================== */

    function parseFunctionError(error, data, status = null) {
        const serverMessage = data?.message || data?.error;

        if (serverMessage) {
            return String(serverMessage);
        }

        const message = String(error?.message || "");
        const httpStatus = Number(status || error?.context?.status || 0);

        if (
            httpStatus === 401 ||
            /401|unauthorized/i.test(message)
        ) {
            return "رفض الخادم الطلب (401). تحقق من جلسة الدخول ومن إعداد Verify JWT للدالة student-management-handler في Supabase.";
        }

        if (
            httpStatus === 403 ||
            /403|forbidden|permission/i.test(message)
        ) {
            return "ليست لديك صلاحية تنفيذ هذا الإجراء. تأكد من أن الحساب مدير المدرسة المرتبط بمدرسة واحدة.";
        }

        if (
            httpStatus === 404 ||
            /404|not found/i.test(message)
        ) {
            return "الدالة الخلفية غير موجودة أو لم تُنشر بالاسم student-management-handler.";
        }

        if (
            /failed to fetch|network|fetch failed/i.test(message)
        ) {
            return "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجددًا.";
        }

        if (httpStatus >= 500) {
            return `حدث خطأ في الخادم (${httpStatus}). راجع سجلات الدالة في Supabase.`;
        }

        return message || "حدث خطأ غير متوقع أثناء الاتصال بالخادم.";
    }

    async function readFunctionErrorResponse(error) {
        const context = error?.context;

        if (!context || typeof context.clone !== "function") {
            return {
                status: context?.status || null,
                data: null
            };
        }

        try {
            const response = context.clone();
            let data = null;

            try {
                data = await response.json();
            } catch {
                try {
                    const responseText = await context.clone().text();

                    if (responseText) {
                        data = { message: responseText };
                    }
                } catch {
                    // لا توجد استجابة نصية قابلة للقراءة.
                }
            }

            return {
                status: response.status || context.status || null,
                data
            };
        } catch {
            return {
                status: context.status || null,
                data: null
            };
        }
    }

    /* =====================================================
       التحقق من جلسة Supabase
       ===================================================== */

    async function getValidAccessToken() {
        if (!state.db?.auth) {
            throw new Error(
                "اتصال Supabase لا يحتوي على نظام المصادقة. تحقق من supabase-config.js."
            );
        }

        let sessionResult;

        try {
            sessionResult = await state.db.auth.getSession();
        } catch (error) {
            console.error(
                "[ILABRAT Auth Session]",
                error?.message || error
            );

            throw new Error(
                "تعذر التحقق من جلسة الدخول. أعد تحميل الصفحة وسجّل الدخول مجددًا."
            );
        }

        if (sessionResult?.error) {
            console.error(
                "[ILABRAT Auth Session]",
                sessionResult.error.message
            );

            throw new Error(
                "تعذر قراءة جلسة الدخول. سجّل الدخول مجددًا."
            );
        }

        const session = sessionResult?.data?.session;

        if (!session?.access_token) {
            console.error(
                "[ILABRAT Auth Session] لا توجد جلسة دخول محفوظة."
            );

            throw new Error(
                "لا توجد جلسة دخول صالحة. سجّل الدخول من صفحة إيلابرات ثم افتح صفحة إدارة الطلاب مجددًا."
            );
        }

        return session.access_token;
    }

    /* =====================================================
       استدعاء Edge Function
       ===================================================== */

    async function callManagementFunction(payload) {
        if (!state.db?.functions) {
            throw new Error(
                "لم يتم تهيئة اتصال Supabase أو خدمة الدوال الخلفية."
            );
        }

        const accessToken = await getValidAccessToken();

        let result;

        try {
            result = await state.db.functions.invoke(
                FUNCTION_NAME,
                {
                    body: payload,
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );
        } catch (error) {
            console.error(
                "[ILABRAT Function Network Error]",
                error?.message || error
            );

            throw new Error(
                "تعذر إرسال الطلب إلى الخادم. تحقق من الاتصال بالإنترنت ثم حاول مجددًا."
            );
        }

        const { data, error } = result || {};

        if (error) {
            const response = await readFunctionErrorResponse(error);

            const errorMessage = parseFunctionError(
                error,
                data || response.data,
                response.status
            );

            console.error("[ILABRAT Function Error]", {
                function: FUNCTION_NAME,
                action: payload?.action || "unknown",
                status: response.status || error?.context?.status || null,
                message: errorMessage,
                response: response.data || data || null
            });

            throw new Error(errorMessage);
        }

        if (!data || data.success !== true) {
            const errorMessage = parseFunctionError(null, data);

            console.error("[ILABRAT Function Invalid Response]", {
                function: FUNCTION_NAME,
                action: payload?.action || "unknown",
                response: data || null
            });

            throw new Error(
                errorMessage || "لم يكتمل تنفيذ الطلب."
            );
        }

        return data;
    }

    /* =====================================================
       تحميل الطلاب
       ===================================================== */

    async function loadStudents(options = {}) {
        if (
            state.loading ||
            state.deleting ||
            state.saving
        ) {
            return;
        }

        setLoading(true);

        if (!options.silent) {
            setStatus("جارٍ تحميل بيانات الطلاب...", "info");
        }

        try {
            const data = await callManagementFunction({
                action: "list"
            });

            /*
             * لا نحدّث بيانات الصفحة إلا بعد نجاح الاستجابة.
             */
            state.school = data.school || null;

            state.classes = Array.isArray(data.classes)
                ? data.classes
                : [];

            state.students = Array.isArray(data.students)
                ? data.students
                : [];
                if (el.search) {
    el.search.disabled = false;
}

            updateSchoolInfo();
            buildGradeOptions();
            buildSectionOptions();
            renderStudents();

            if (!options.silent) {
                setStatus(
                    `تم تحميل ${state.students.length} طالب بنجاح.`,
                    "success"
                );
            }

        } catch (error) {
            console.error("[ILABRAT Student Management]", error);

            /*
             * نحافظ على البيانات المحمّلة سابقًا عند فشل التحديث.
             */
            updateSchoolInfo();
            renderStudents();

            setStatus(
                error?.message || "تعذر تحميل بيانات الطلاب.",
                "error"
            );

        } finally {
            setLoading(false);
        }
    }

    /* =====================================================
       حذف الطالب
       ===================================================== */

    async function deleteStudent() {
        const student = state.pendingDeleteStudent;

        if (!student || state.deleting) return;

        setDeleting(true);

        setDeleteMessage(
            "جارٍ حذف حساب الطالب وبياناته من النظام...",
            "info"
        );

        try {
            const data = await callManagementFunction({
                action: "delete",
                student_id: student.id
            });

            state.students = state.students.filter(
                (item) =>
                    normalizeId(item.id) !== normalizeId(student.id) &&
                    normalizeId(item.profile_id) !==
                        normalizeId(student.profile_id)
            );

            closeModal(el.deleteModal);
            closeModal(el.detailsModal);

            state.pendingDeleteStudent = null;
            state.selectedStudent = null;

            renderStudents();

            setStatus(
                data.message || "تم حذف حساب الطالب بنجاح.",
                "success"
            );

        } catch (error) {
            console.error("[ILABRAT Student Delete]", error);

            setDeleteMessage(
                error?.message ||
                    "تعذر حذف الطالب. لم يتم تأكيد اكتمال العملية.",
                "error"
            );

        } finally {
            setDeleting(false);
        }
    }

    /* =====================================================
       مسح عوامل التصفية
       ===================================================== */

    function clearFilters() {
        if (el.gradeFilter) {
            el.gradeFilter.value = "";
        }

        if (el.sectionFilter) {
            el.sectionFilter.value = "";
        }

        if (el.search) {
            el.search.value = "";
        }

        buildSectionOptions();
        renderStudents();

        setStatus(
            "تم مسح البحث والتصفية.",
            "info"
        );
    }

    /* =====================================================
       ربط أحداث الصفحة
       ===================================================== */

    function bindEvents() {

        /* إجراءات صف الطالب */
        el.tableBody?.addEventListener("click", async (event) => {
            const button = event.target.closest(
                "[data-action][data-student-id]"
            );

            if (!button) return;

            const student = findStudentById(
                button.dataset.studentId
            );

            if (!student) {
                setStatus(
                    "تعذر العثور على بيانات الطالب المحدد.",
                    "error"
                );
                return;
            }

            const action = button.dataset.action;

            if (action === "edit") {
                openEditStudent(student);

            } else if (action === "delete") {
                openDeleteConfirmation(student);

            } else if (action === "copy-code") {
                await copyStudentCode(student, button);
            }
        });

        /* البحث والتصفية */
        el.gradeFilter?.addEventListener("change", () => {
            buildSectionOptions();
            renderStudents();
        });

        el.sectionFilter?.addEventListener(
            "change",
            renderStudents
        );

        el.search?.addEventListener(
            "input",
            renderStudents
        );

        el.refreshButton?.addEventListener("click", () => {
            loadStudents();
        });

        el.clearFiltersButton?.addEventListener(
            "click",
            clearFilters
        );

        /* حفظ التعديل */
        el.editForm?.addEventListener(
            "submit",
            saveStudentChanges
        );

        /* إلغاء التعديل */
        el.cancelEditButton?.addEventListener("click", () => {
            if (state.saving) return;

            state.editingStudent = null;
            closeModal(el.editModal);
        });

        /* إغلاق نافذة التعديل */
        document
            .querySelectorAll("[data-close-edit-modal]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    if (state.saving) return;

                    state.editingStudent = null;
                    closeModal(el.editModal);
                });
            });

        /* التعديل من نافذة التفاصيل */
        el.editFromDetailsButton?.addEventListener("click", () => {
            if (!state.selectedStudent) return;

            openEditStudent(state.selectedStudent);
        });

        /* حذف الطالب من نافذة التفاصيل */
        el.deleteFromDetailsButton?.addEventListener("click", () => {
            const student = state.selectedStudent;

            if (!student) return;

            closeModal(el.detailsModal);
            openDeleteConfirmation(student);
        });

        /* تأكيد الحذف */
        el.cancelDeleteButton?.addEventListener("click", () => {
            if (state.deleting) return;

            state.pendingDeleteStudent = null;
            closeModal(el.deleteModal);
        });

        el.confirmDeleteButton?.addEventListener(
            "click",
            deleteStudent
        );

        /* إغلاق نافذة التفاصيل */
        document
            .querySelectorAll("[data-close-modal]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    closeModal(el.detailsModal);
                });
            });

        /* إغلاق نافذة الحذف */
        document
            .querySelectorAll("[data-close-delete-modal]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    if (state.deleting) return;

                    state.pendingDeleteStudent = null;
                    closeModal(el.deleteModal);
                });
            });

        /* إغلاق النوافذ عند الضغط على الخلفية */
        [el.detailsModal, el.editModal, el.deleteModal].forEach((modal) => {
            modal?.addEventListener("click", (event) => {
                if (event.target !== modal) return;

                if (state.deleting || state.saving) return;

                if (modal === el.deleteModal) {
                    state.pendingDeleteStudent = null;
                }

                if (modal === el.editModal) {
                    state.editingStudent = null;
                }

                closeModal(modal);
            });
        });

        /* إغلاق النوافذ بمفتاح Escape */
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;

            if (state.deleting || state.saving) return;

            state.pendingDeleteStudent = null;
            state.editingStudent = null;

            closeAllModals();
        });
    }

    /* =====================================================
       العثور على اتصال Supabase
       ===================================================== */

    function findSupabaseClient() {
        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {
            return window.supabaseClient;
        }

        if (
            window.supabase &&
            typeof window.supabase.from === "function"
        ) {
            return window.supabase;
        }

        if (
            window.db &&
            typeof window.db.from === "function"
        ) {
            return window.db;
        }

        return null;
    }

    /* =====================================================
       تهيئة الصفحة
       ===================================================== */

    async function init() {
        bindEvents();

        state.db = findSupabaseClient();

        if (!state.db) {
            setStatus(
                "تعذر العثور على اتصال Supabase. تحقق من ملفات إعداد الاتصال وترتيب تحميلها في الصفحة.",
                "error"
            );

            console.error(
                "[ILABRAT] Supabase client not found. " +
                "Expected window.supabaseClient or window.db."
            );

            return;
        }

        if (!state.db.auth || !state.db.functions) {
            setStatus(
                "اتصال Supabase غير مكتمل. تأكد من تحميل مكتبة Supabase وإعداد الاتصال الصحيح.",
                "error"
            );

            console.error(
                "[ILABRAT] Supabase client is missing auth or functions."
            );

            return;
        }

        await loadStudents();
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