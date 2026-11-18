
"use strict";

/* =========================================================
   ILABRAT STUDENTS
   عرض الجداول الدراسية لمدير المدرسة
   ========================================================= */

document.addEventListener("DOMContentLoaded", initializeTimetableView);

/* =========================================================
   إعدادات الصفحة
   ========================================================= */

const db = window.supabaseClient;

const DAYS = [
    { id: "sun", name: "الأحد", offset: 0 },
    { id: "mon", name: "الاثنين", offset: 1 },
    { id: "tue", name: "الثلاثاء", offset: 2 },
    { id: "wed", name: "الأربعاء", offset: 3 },
    { id: "thu", name: "الخميس", offset: 4 }
];

let allClasses = [];
let currentLessons = [];

let selectedClassId = null;
let schoolId = null;
let currentUserId = null;
let currentClass = null;

let loadRequestNumber = 0;
let isSavingLesson = false;

/* =========================================================
   عناصر الصفحة
   ========================================================= */

let stageSelect;
let gradeSelect;
let genderSelect;
let sectionSelect;
let weekStart;
let scheduleBody;
let pageMessage;
let printScheduleBtn;

let schoolDisplayName;
let adminDisplayName;
let profileAvatar;

/* عناصر نافذة التعديل */

let editLessonModal;
let editLessonForm;
let editLessonId;
let editSubject;
let editTeacher;
let editStartTime;
let editEndTime;
let editLessonNote;
let editLessonMessage;
let saveEditLessonBtn;

function getPageElements() {
    stageSelect = document.getElementById("stageSelect");
    gradeSelect = document.getElementById("gradeSelect");
    genderSelect = document.getElementById("genderSelect");
    sectionSelect = document.getElementById("sectionSelect");

    weekStart = document.getElementById("weekStart");
    scheduleBody = document.getElementById("scheduleBody");
    pageMessage = document.getElementById("pageMessage");

    schoolDisplayName = document.getElementById("schoolDisplayName");
    adminDisplayName = document.getElementById("adminDisplayName");
    profileAvatar = document.getElementById("profileAvatar");

    printScheduleBtn = document.getElementById("printScheduleBtn");

    editLessonModal = document.getElementById("editLessonModal");
    editLessonForm = document.getElementById("editLessonForm");
    editLessonId = document.getElementById("editLessonId");

    editSubject = document.getElementById("editSubject");
    editTeacher = document.getElementById("editTeacher");

    editStartTime = document.getElementById("editStartTime");
    editEndTime = document.getElementById("editEndTime");
    editLessonNote = document.getElementById("editLessonNote");

    editLessonMessage = document.getElementById("editLessonMessage");
    saveEditLessonBtn = document.getElementById("saveEditLesson");
}

/* =========================================================
   الرسائل
   ========================================================= */

function showMessage(message, type = "info") {
    if (!pageMessage) return;

    pageMessage.textContent = message;

    pageMessage.classList.remove(
        "error",
        "success",
        "info",
        "warning"
    );

    if (type) {
        pageMessage.classList.add(type);
    }

    pageMessage.style.display = "block";
}

function hideMessage() {
    if (!pageMessage) return;

    pageMessage.textContent = "";

    pageMessage.classList.remove(
        "error",
        "success",
        "info",
        "warning"
    );

    pageMessage.style.display = "none";
}

function showEditMessage(message, type = "error") {
    if (!editLessonMessage) return;

    editLessonMessage.textContent = message;

    editLessonMessage.classList.remove(
        "error",
        "success",
        "info",
        "warning"
    );

    editLessonMessage.classList.add(type);
    editLessonMessage.style.display = "block";
}

function hideEditMessage() {
    if (!editLessonMessage) return;

    editLessonMessage.textContent = "";
    editLessonMessage.classList.remove(
        "error",
        "success",
        "info",
        "warning"
    );

    editLessonMessage.style.display = "none";
}

/* =========================================================
   حماية النصوص المعروضة
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];
    });
}

/* =========================================================
   التواريخ
   ========================================================= */

function parseLocalDate(value) {
    if (!value) return null;

    const parts = String(value).split("-").map(Number);

    if (
        parts.length !== 3 ||
        parts.some(Number.isNaN)
    ) {
        return null;
    }

    const date = new Date(
        parts[0],
        parts[1] - 1,
        parts[2],
        12,
        0,
        0
    );

    if (
        date.getFullYear() !== parts[0] ||
        date.getMonth() !== parts[1] - 1 ||
        date.getDate() !== parts[2]
    ) {
        return null;
    }

    return date;
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatArabicDate(date) {
    if (
        !(date instanceof Date) ||
        Number.isNaN(date.getTime())
    ) {
        return "";
    }

    return new Intl.DateTimeFormat("ar-IQ", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function getWeekDate(offset) {
    const startDate = parseLocalDate(weekStart?.value);

    if (!startDate) return null;

    const date = new Date(startDate);
    date.setDate(date.getDate() + offset);

    return date;
}

function isValidWeekStart() {
    const date = parseLocalDate(weekStart?.value);

    return Boolean(date && date.getDay() === 0);
}

function setCurrentWeek() {
    if (!weekStart) return;

    const today = new Date();

    const sunday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        12
    );

    sunday.setDate(
        sunday.getDate() - sunday.getDay()
    );

    weekStart.value = formatDateInput(sunday);
}

/* =========================================================
   تهيئة الصفحة والتحقق من المستخدم
   ========================================================= */

async function initializeTimetableView() {
    getPageElements();

    if (
        !stageSelect ||
        !gradeSelect ||
        !genderSelect ||
        !sectionSelect ||
        !weekStart ||
        !scheduleBody
    ) {
        console.error(
            "بعض عناصر صفحة عرض الجداول غير موجودة."
        );

        return;
    }

    if (!db) {
        showMessage(
            "تعذر الاتصال بقاعدة البيانات. تحقق من إعدادات Supabase.",
            "error"
        );

        return;
    }

    disablePrinting();

    if (printScheduleBtn) {
        printScheduleBtn.addEventListener(
            "click",
            printSchedule
        );
    }

    try {
        const {
            data: sessionData,
            error: sessionError
        } = await db.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData?.session;

        if (!session) {
            window.location.href = "index.html";
            return;
        }

        currentUserId = session.user.id;

        const {
            data: profile,
            error: profileError
        } = await db
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", currentUserId)
            .single();

        if (profileError) {
            throw profileError;
        }

        if (!profile || profile.role !== "school_admin") {
            showMessage(
                "هذه الصفحة مخصصة لمدير المدرسة فقط.",
                "error"
            );

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1800);

            return;
        }

        updateAdminInformation(profile);

        await loadSchoolInformation();

        setCurrentWeek();

        updateTableDayHeaders();

        bindEvents();

        await loadClasses();

    } catch (error) {
        console.error(
            "خطأ في تهيئة صفحة عرض الجداول:",
            error
        );

        showMessage(
            error.message || "حدث خطأ أثناء تحميل الصفحة.",
            "error"
        );
    }
}

/* =========================================================
   معلومات مدير المدرسة
   ========================================================= */

function updateAdminInformation(profile) {
    const name = profile.full_name || "مدير المدرسة";

    if (adminDisplayName) {
        adminDisplayName.textContent = name;
    }

    if (profileAvatar) {
        profileAvatar.textContent = name.trim().charAt(0) || "م";
    }
}

/* =========================================================
   معلومات المدرسة
   ========================================================= */

async function loadSchoolInformation() {
    const {
        data: membership,
        error: membershipError
    } = await db
        .from("school_memberships")
        .select("school_id")
        .eq("profile_id", currentUserId)
        .eq("role", "school_admin")
        .maybeSingle();

    if (membershipError) {
        throw membershipError;
    }

    if (!membership?.school_id) {
        throw new Error(
            "لم يتم العثور على المدرسة المرتبطة بحسابك."
        );
    }

    schoolId = membership.school_id;

    const {
        data: school,
        error: schoolError
    } = await db
        .from("schools")
        .select("id, name")
        .eq("id", schoolId)
        .single();

    if (schoolError) {
        throw schoolError;
    }

    if (schoolDisplayName) {
        schoolDisplayName.textContent =
            school?.name || "مدرستي";
    }
}

/* =========================================================
   ربط الأحداث
   ========================================================= */

function bindEvents() {
    stageSelect.addEventListener(
        "change",
        updateGrades
    );

    gradeSelect.addEventListener(
        "change",
        updateGenders
    );

    genderSelect.addEventListener(
        "change",
        updateSections
    );

    sectionSelect.addEventListener(
        "change",
        selectClass
    );

    weekStart.addEventListener("change", () => {
        updateTableDayHeaders();

        if (!isValidWeekStart()) {
            disablePrinting();

            renderSchedule();

            showMessage(
                "يرجى اختيار تاريخ يوم الأحد لبداية الأسبوع.",
                "warning"
            );

            return;
        }

        hideMessage();
        renderSchedule();
    });

    /* أحداث نافذة تعديل الحصة */

    if (editLessonForm) {
        editLessonForm.addEventListener(
            "submit",
            saveLessonChanges
        );
    }

    document.getElementById("closeEditModal")
        ?.addEventListener("click", closeEditModal);

    document.getElementById("cancelEditLesson")
        ?.addEventListener("click", closeEditModal);

    editLessonModal?.querySelectorAll("[data-close-edit]")
        .forEach(element => {
            element.addEventListener("click", closeEditModal);
        });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            editLessonModal &&
            !editLessonModal.hidden
        ) {
            closeEditModal();
        }
    });

    /* أحداث أزرار تعديل الحصص */

    scheduleBody.addEventListener("click", event => {
        const button = event.target.closest(
            ".lesson-edit-button"
        );

        if (!button) return;

        const lessonId = button.dataset.lessonId;

        const lesson = currentLessons.find(
            item => String(item.id) === String(lessonId)
        );

        if (lesson) {
            openEditLesson(lesson);
        }
    });
}

/* =========================================================
   تحميل الصفوف الدراسية
   ========================================================= */

async function loadClasses() {
    showMessage(
        "جارٍ تحميل الصفوف الدراسية...",
        "info"
    );

    stageSelect.disabled = true;

    const {
        data,
        error
    } = await db
        .from("classes")
        .select(`
            id,
            name,
            stage,
            grade_name,
            gender,
            section_name,
            school_id
        `)
        .eq("school_id", schoolId)
        .order("stage", { ascending: true })
        .order("grade_name", { ascending: true })
        .order("section_name", { ascending: true });

    if (error) {
        throw error;
    }

    allClasses = data || [];

    stageSelect.innerHTML =
        '<option value="">اختر المرحلة</option>';

    if (!allClasses.length) {
        resetSelection();

        stageSelect.disabled = true;

        showMessage(
            "لا توجد شعب دراسية مسجلة في المدرسة.",
            "info"
        );

        return;
    }

    const stages = [
        ...new Set(
            allClasses
                .map(item => item.stage)
                .filter(Boolean)
        )
    ];

    stages.forEach(stage => {
        stageSelect.add(
            new Option(stage, stage)
        );
    });

    stageSelect.disabled = false;

    resetDependentSelects("grade");

    hideMessage();
}

/* =========================================================
   تحديث قائمة الصفوف
   ========================================================= */

function updateGrades() {
    resetSelection();

    const stage = stageSelect.value;

    const grades = [
        ...new Set(
            allClasses
                .filter(item => item.stage === stage)
                .map(item => item.grade_name)
                .filter(Boolean)
        )
    ];

    gradeSelect.innerHTML =
        '<option value="">اختر الصف</option>';

    grades.forEach(grade => {
        gradeSelect.add(
            new Option(grade, grade)
        );
    });

    gradeSelect.disabled = !grades.length;

    resetDependentSelects("gender");

    hideMessage();
}

/* =========================================================
   تحديث قائمة الجنس
   ========================================================= */

function updateGenders() {
    resetSelection();

    const stage = stageSelect.value;
    const grade = gradeSelect.value;

    const genders = [
        ...new Set(
            allClasses
                .filter(item =>
                    item.stage === stage &&
                    item.grade_name === grade
                )
                .map(item => item.gender)
                .filter(Boolean)
        )
    ];

    genderSelect.innerHTML =
        '<option value="">اختر الجنس</option>';

    genders.forEach(gender => {
        genderSelect.add(
            new Option(gender, gender)
        );
    });

    genderSelect.disabled = !genders.length;

    resetDependentSelects("section");

    hideMessage();
}

/* =========================================================
   تحديث قائمة الشعب
   ========================================================= */

function updateSections() {
    resetSelection();

    const stage = stageSelect.value;
    const grade = gradeSelect.value;
    const gender = genderSelect.value;

    const sections = allClasses.filter(item =>
        item.stage === stage &&
        item.grade_name === grade &&
        item.gender === gender
    );

    sectionSelect.innerHTML =
        '<option value="">اختر الشعبة</option>';

    sections.forEach(section => {
        const option = new Option(
            section.section_name || section.name,
            section.id
        );

        sectionSelect.add(option);
    });

    sectionSelect.disabled = !sections.length;

    hideMessage();
}

/* =========================================================
   إعادة ضبط القوائم التابعة
   ========================================================= */

function resetDependentSelects(from) {
    if (from === "grade") {
        gradeSelect.innerHTML =
            '<option value="">اختر الصف</option>';

        gradeSelect.disabled = true;
    }

    if (
        from === "grade" ||
        from === "gender"
    ) {
        genderSelect.innerHTML =
            '<option value="">اختر الجنس</option>';

        genderSelect.disabled = true;
    }

    if (
        from === "grade" ||
        from === "gender" ||
        from === "section"
    ) {
        sectionSelect.innerHTML =
            '<option value="">اختر الشعبة</option>';

        sectionSelect.disabled = true;
    }
}

/* =========================================================
   اختيار الشعبة
   ========================================================= */

async function selectClass() {
    const classId = sectionSelect.value;

    resetScheduleDisplay();

    if (!classId) {
        selectedClassId = null;
        currentClass = null;
        return;
    }

    selectedClassId = Number(classId);

    currentClass = allClasses.find(
        item => Number(item.id) === selectedClassId
    ) || null;

    if (!currentClass) {
        selectedClassId = null;
        return;
    }

    await loadLessons();
}

/* =========================================================
   تحميل الحصص
   ========================================================= */

async function loadLessons() {
    if (!selectedClassId || !schoolId) {
        return;
    }

    disablePrinting();

    const requestedClassId = selectedClassId;
    const requestNumber = ++loadRequestNumber;

    scheduleBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-message">
                جارٍ تحميل الجدول الدراسي...
            </td>
        </tr>
    `;

    try {
        const {
            data,
            error
        } = await db
            .from("timetable_lessons")
            .select(`
                id,
                class_id,
                school_id,
                academic_year,
                day_of_week,
                period,
                subject,
                teacher_name,
                start_time,
                end_time,
                note,
                is_published
            `)
            .eq("class_id", requestedClassId)
            .eq("school_id", schoolId)
            .order("period", { ascending: true });

        if (error) {
            throw error;
        }

        if (
            requestedClassId !== selectedClassId ||
            requestNumber !== loadRequestNumber
        ) {
            return;
        }

        currentLessons = data || [];

        renderSchedule();

    } catch (error) {
        console.error(
            "خطأ في تحميل الحصص:",
            error
        );

        if (
            requestedClassId !== selectedClassId ||
            requestNumber !== loadRequestNumber
        ) {
            return;
        }

        currentLessons = [];

        disablePrinting();

        scheduleBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    تعذر تحميل الجدول الدراسي.
                </td>
            </tr>
        `;

        showMessage(
            error.message || "حدث خطأ أثناء تحميل الجدول.",
            "error"
        );
    }
}

/* =========================================================
   توحيد أسماء الأيام
   ========================================================= */

function normalizeDay(day) {
    if (day === null || day === undefined) {
        return "";
    }

    const value = String(day)
        .trim()
        .toLowerCase();

    const aliases = {
        "0": "sun",
        "1": "mon",
        "2": "tue",
        "3": "wed",
        "4": "thu",

        "sunday": "sun",
        "monday": "mon",
        "tuesday": "tue",
        "wednesday": "wed",
        "thursday": "thu",

        "الأحد": "sun",
        "الاحد": "sun",
        "الاثنين": "mon",
        "الإثنين": "mon",
        "الثلاثاء": "tue",
        "الأربعاء": "wed",
        "الاربعاء": "wed",
        "الخميس": "thu",

        "sun": "sun",
        "mon": "mon",
        "tue": "tue",
        "wed": "wed",
        "thu": "thu"
    };

    return aliases[value] || value;
}

/* =========================================================
   عرض الجدول الأسبوعي
   ========================================================= */

function renderSchedule() {
    if (!scheduleBody) {
        return;
    }

    if (!selectedClassId) {
        resetScheduleDisplay();
        return;
    }

    if (!isValidWeekStart()) {
        disablePrinting();

        scheduleBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    اختر يوم الأحد لتحديد بداية الأسبوع.
                </td>
            </tr>
        `;

        return;
    }

    updateTableDayHeaders();

    if (!currentLessons.length) {
        disablePrinting();

        scheduleBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    لا توجد حصص مسجلة لهذه الشعبة.
                </td>
            </tr>
        `;

        return;
    }

    const periods = [
        ...new Set(
            currentLessons
                .map(lesson => Number(lesson.period))
                .filter(period =>
                    Number.isFinite(period) &&
                    period > 0
                )
        )
    ].sort((a, b) => a - b);

    if (!periods.length) {
        disablePrinting();

        scheduleBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    لا توجد حصص صالحة للعرض.
                </td>
            </tr>
        `;

        return;
    }

    const lessonMap = new Map();

    currentLessons.forEach(lesson => {
        const day = normalizeDay(lesson.day_of_week);
        const period = Number(lesson.period);

        if (!DAYS.some(item => item.id === day)) {
            return;
        }

        const key = `${day}-${period}`;

        if (!lessonMap.has(key)) {
            lessonMap.set(key, []);
        }

        lessonMap.get(key).push(lesson);
    });

    scheduleBody.innerHTML = periods.map(period => {
        const cells = DAYS.map(day => {
            const lessons =
                lessonMap.get(`${day.id}-${period}`) || [];

            if (!lessons.length) {
                return `
                    <td class="lesson-cell empty-lesson">
                        <span>—</span>
                    </td>
                `;
            }

            return `
                <td class="lesson-cell">
                    ${lessons
                        .map(lesson => renderLessonCell(lesson))
                        .join("")}
                </td>
            `;
        }).join("");

        return `
            <tr>
                <th scope="row" class="period-cell">
                    الحصة ${escapeHTML(period)}
                </th>
                ${cells}
            </tr>
        `;
    }).join("");

    enablePrinting();
    hideMessage();
}

/* =========================================================
   محتوى خلية الحصة
   ========================================================= */

function renderLessonCell(lesson) {
    const subject = escapeHTML(
        lesson.subject || "بدون مادة"
    );

    const teacher = escapeHTML(
        lesson.teacher_name || ""
    );

    const note = escapeHTML(
        lesson.note || ""
    );

    const time = formatLessonTime(
        lesson.start_time,
        lesson.end_time
    );

    return `
        <div class="lesson-content">

            <div class="lesson-subject">
                ${subject}
            </div>

            ${teacher ? `
                <div class="lesson-teacher">
                    ${teacher}
                </div>
            ` : ""}

            ${time ? `
                <div class="lesson-time">
                    ${escapeHTML(time)}
                </div>
            ` : ""}

            ${note ? `
                <div class="lesson-note">
                    ${note}
                </div>
            ` : ""}

            <button
                type="button"
                class="lesson-edit-button no-print"
                data-lesson-id="${escapeHTML(lesson.id)}"
            >
                تعديل
            </button>

        </div>
    `;
}

/* =========================================================
   تنسيق وقت الحصة
   ========================================================= */

function formatLessonTime(start, end) {
    if (!start && !end) {
        return "";
    }

    const format = value => {
        if (!value) return "";

        return String(value).slice(0, 5);
    };

    if (start && end) {
        return `${format(start)} - ${format(end)}`;
    }

    return format(start || end);
}

/* =========================================================
   تواريخ أيام الأسبوع في رأس الجدول
   ========================================================= */

function updateTableDayHeaders() {
    const table = document.getElementById("viewSchedule");

    if (!table) return;

    const headerCells = table.querySelectorAll(
        "thead th"
    );

    DAYS.forEach((day, index) => {
        const cell = headerCells[index + 1];

        if (!cell) return;

        const date = getWeekDate(day.offset);

        if (!date) {
            cell.textContent = day.name;
            return;
        }

        cell.innerHTML = `
            <span class="day-name">
                ${escapeHTML(day.name)}
            </span>

            <span class="day-date">
                ${escapeHTML(formatArabicDate(date))}
            </span>
        `;
    });
}

/* =========================================================
   تحميل خيارات المادة والمدرّس
   ========================================================= */

async function loadEditOptions(currentLesson) {
    editSubject.innerHTML =
        '<option value="">جارٍ تحميل المواد...</option>';

    editTeacher.innerHTML =
        '<option value="">جارٍ تحميل المدرّسين...</option>';

    editSubject.disabled = true;
    editTeacher.disabled = true;

    const {
        data,
        error
    } = await db
        .from("timetable_lessons")
        .select("subject, teacher_name")
        .eq("school_id", schoolId);

    if (error) {
        throw error;
    }

    const lessons = data || [];

    const subjects = [
        ...new Set(
            lessons
                .map(item => String(item.subject || "").trim())
                .filter(Boolean)
        )
    ];

    const teachers = [
        ...new Set(
            lessons
                .map(item => String(item.teacher_name || "").trim())
                .filter(Boolean)
        )
    ];

    /* ضمان ظهور القيمة الحالية حتى لو لم توجد في بقية الحصص */

    const currentSubject = String(
        currentLesson.subject || ""
    ).trim();

    const currentTeacher = String(
        currentLesson.teacher_name || ""
    ).trim();

    if (
        currentSubject &&
        !subjects.includes(currentSubject)
    ) {
        subjects.push(currentSubject);
    }

    if (
        currentTeacher &&
        !teachers.includes(currentTeacher)
    ) {
        teachers.push(currentTeacher);
    }

    subjects.sort((a, b) => a.localeCompare(b, "ar"));
    teachers.sort((a, b) => a.localeCompare(b, "ar"));

    editSubject.innerHTML =
        '<option value="">اختر المادة</option>';

    subjects.forEach(subject => {
        editSubject.add(
            new Option(subject, subject)
        );
    });

    editTeacher.innerHTML =
        '<option value="">اختر المدرّس</option>';

    teachers.forEach(teacher => {
        editTeacher.add(
            new Option(teacher, teacher)
        );
    });

    editSubject.value = currentSubject;
    editTeacher.value = currentTeacher;

    editSubject.disabled = false;
    editTeacher.disabled = false;

    if (!subjects.length) {
        editSubject.innerHTML =
            '<option value="">لا توجد مواد مسجلة</option>';
    }

    if (!teachers.length) {
        editTeacher.innerHTML =
            '<option value="">لا يوجد مدرسون مسجلون في الجداول</option>';
    }
}

/* =========================================================
   فتح نافذة تعديل الحصة
   ========================================================= */

async function openEditLesson(lesson) {
    if (
        !lesson ||
        !selectedClassId ||
        !editLessonModal ||
        !editLessonForm
    ) {
        showMessage(
            "تعذر فتح نافذة التعديل. تحقق من وجود عناصر نافذة التعديل في HTML.",
            "error"
        );

        return;
    }

    hideEditMessage();

    editLessonForm.reset();

    editLessonId.value = lesson.id;

    editStartTime.value =
        lesson.start_time
            ? String(lesson.start_time).slice(0, 5)
            : "";

    editEndTime.value =
        lesson.end_time
            ? String(lesson.end_time).slice(0, 5)
            : "";

    editLessonNote.value = lesson.note || "";

    editSubject.disabled = true;
    editTeacher.disabled = true;

    editSubject.innerHTML =
        '<option value="">جارٍ تحميل المواد...</option>';

    editTeacher.innerHTML =
        '<option value="">جارٍ تحميل المدرّسين...</option>';

    editLessonModal.hidden = false;
    editLessonModal.setAttribute("aria-hidden", "false");

    document.body.classList.add("edit-modal-open");

    try {
        await loadEditOptions(lesson);

        editSubject.focus();

    } catch (error) {
        console.error(
            "خطأ في تحميل خيارات التعديل:",
            error
        );

        showEditMessage(
            error.message || "تعذر تحميل المواد والمدرّسين.",
            "error"
        );
    }
}

/* =========================================================
   إغلاق نافذة التعديل
   ========================================================= */

function closeEditModal() {
    if (!editLessonModal) return;

    if (isSavingLesson) return;

    editLessonModal.hidden = true;
    editLessonModal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("edit-modal-open");

    hideEditMessage();
}

/* =========================================================
   حفظ تعديلات الحصة
   ========================================================= */

async function saveLessonChanges(event) {
    event.preventDefault();

    if (isSavingLesson) return;

    const lessonId = editLessonId?.value;

    const lesson = currentLessons.find(
        item => String(item.id) === String(lessonId)
    );

    if (!lesson || !selectedClassId || !schoolId) {
        showEditMessage(
            "تعذر تحديد الحصة المطلوب تعديلها.",
            "error"
        );

        return;
    }

    const subject = editSubject.value.trim();
    const teacher = editTeacher.value.trim();

    const startTime = editStartTime.value.trim();
    const endTime = editEndTime.value.trim();

    const note = editLessonNote.value.trim();

    if (!subject) {
        showEditMessage(
            "يرجى اختيار المادة الدراسية.",
            "warning"
        );

        editSubject.focus();
        return;
    }

    if (!teacher) {
        showEditMessage(
            "يرجى اختيار المدرّس.",
            "warning"
        );

        editTeacher.focus();
        return;
    }

    if (
        startTime &&
        endTime &&
        startTime >= endTime
    ) {
        showEditMessage(
            "وقت نهاية الحصة يجب أن يكون بعد وقت بدايتها.",
            "warning"
        );

        editEndTime.focus();
        return;
    }

    const updates = {
        subject: subject,
        teacher_name: teacher,
        start_time: startTime || null,
        end_time: endTime || null,
        note: note
    };

    isSavingLesson = true;

    if (saveEditLessonBtn) {
        saveEditLessonBtn.disabled = true;
        saveEditLessonBtn.textContent = "جارٍ الحفظ...";
    }

    try {
        const {
            data,
            error
        } = await db
            .from("timetable_lessons")
            .update(updates)
            .eq("id", lesson.id)
            .eq("class_id", selectedClassId)
            .eq("school_id", schoolId)
            .select("id");

        if (error) {
            throw error;
        }

        if (!data || !data.length) {
            throw new Error(
                "لم يتم تحديث الحصة. تحقق من صلاحيات التعديل وسياسات قاعدة البيانات."
            );
        }

        /*
           إعادة حالة الحفظ إلى false قبل إغلاق النافذة،
           لأن closeEditModal تمنع الإغلاق أثناء الحفظ.
        */
        isSavingLesson = false;

        closeEditModal();

        showMessage(
            "تم تحديث الحصة بنجاح.",
            "success"
        );

        await loadLessons();

    } catch (error) {
        console.error(
            "خطأ في تعديل الحصة:",
            error
        );

        showEditMessage(
            error.message || "تعذر تحديث الحصة.",
            "error"
        );

    } finally {
        isSavingLesson = false;

        if (saveEditLessonBtn) {
            saveEditLessonBtn.disabled = false;
            saveEditLessonBtn.textContent = "حفظ التعديلات";
        }
    }
}

/* =========================================================
   الطباعة: طباعة الجدول وحده فقط
   ========================================================= */

function enablePrinting() {
    if (!printScheduleBtn) return;

    printScheduleBtn.disabled = !(
        selectedClassId &&
        currentLessons.length > 0 &&
        isValidWeekStart()
    );
}

function disablePrinting() {
    if (printScheduleBtn) {
        printScheduleBtn.disabled = true;
    }
}

function printSchedule() {
    if (
        !selectedClassId ||
        !currentLessons.length ||
        !isValidWeekStart()
    ) {
        alert(
            "يرجى اختيار شعبة تحتوي على جدول دراسي وتحديد بداية الأسبوع."
        );

        return;
    }

    const printArea = document.getElementById(
        "schedulePrintArea"
    );

    if (!printArea) {
        alert("تعذر العثور على منطقة الجدول المطلوب طباعتها.");
        return;
    }

    const printSchoolName =
        document.getElementById("printSchoolName");

    const printClassInfo =
        document.getElementById("printClassInfo");

    const printWeekInfo =
        document.getElementById("printWeekInfo");

    const startDate = parseLocalDate(weekStart.value);
    const endDate = getWeekDate(4);

    if (!startDate || !endDate) {
        alert("تاريخ الأسبوع غير صالح.");
        return;
    }

    if (printSchoolName) {
        printSchoolName.textContent =
            schoolDisplayName?.textContent || "المدرسة";
    }

    if (printClassInfo && currentClass) {
        printClassInfo.textContent = [
            currentClass.stage,
            currentClass.grade_name,
            currentClass.gender,
            currentClass.section_name || currentClass.name
        ]
            .filter(Boolean)
            .join(" | ");
    }

    if (printWeekInfo) {
        printWeekInfo.textContent =
            `من ${formatArabicDate(startDate)} إلى ${formatArabicDate(endDate)}`;
    }

    /*
       فتح نافذة مستقلة للطباعة.
       لا يتم نسخ القائمة الجانبية أو الشريط العلوي
       أو أزرار الصفحة.
    */

    const printWindow = window.open(
        "",
        "_blank",
        "width=1100,height=800"
    );

    if (!printWindow) {
        alert(
            "يرجى السماح بالنوافذ المنبثقة حتى تتمكن من طباعة الجدول."
        );

        return;
    }

    const stylesheets = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
    ).map(link => {
        return `<link rel="stylesheet" href="${escapeHTML(link.href)}">`;
    }).join("\n");

    const clonedArea = printArea.cloneNode(true);

    clonedArea.querySelectorAll(
        ".no-print, button"
    ).forEach(element => element.remove());

    const printStyles = `
        <style>
            @page {
                size: landscape;
                margin: 12mm;
            }

            * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            html,
            body {
                direction: rtl;
                font-family: "Cairo", Arial, sans-serif;
                background: #fff !important;
                color: #222;
                margin: 0;
                padding: 0;
            }

            body {
                padding: 10px;
            }

            #schedulePrintArea {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 12px !important;
                border: 0 !important;
                box-shadow: none !important;
                background: #fff !important;
            }

            #printHeader {
                display: block !important;
                text-align: center;
                margin-bottom: 18px;
                padding: 12px;
                border-bottom: 2px solid #5A1825;
            }

            #printHeader h2 {
                color: #5A1825;
                margin: 0 0 12px;
                font-size: 22px;
            }

            .print-school-name,
            .print-class-info,
            .print-week-info {
                display: block !important;
                margin: 5px 0;
                font-size: 13px;
                font-weight: 700;
            }

            .table-responsive,
            .table-scroll {
                overflow: visible !important;
                width: 100% !important;
                max-height: none !important;
            }

            #viewSchedule {
                width: 100% !important;
                min-width: 0 !important;
                border-collapse: collapse !important;
                table-layout: fixed;
                page-break-inside: auto;
            }

            #viewSchedule th,
            #viewSchedule td {
                border: 1px solid #777 !important;
                padding: 9px 5px !important;
                text-align: center !important;
                vertical-align: middle !important;
                color: #222 !important;
                background: #fff !important;
                font-size: 11px !important;
                overflow-wrap: anywhere;
            }

            #viewSchedule thead th {
                background: #F3EEE7 !important;
                color: #43131D !important;
                font-weight: 800 !important;
            }

            #viewSchedule tr {
                page-break-inside: avoid;
            }

            .lesson-content {
                padding: 3px;
                page-break-inside: avoid;
            }

            .lesson-subject {
                font-weight: 800;
                color: #5A1825 !important;
                margin-bottom: 4px;
            }

            .lesson-teacher,
            .lesson-time,
            .lesson-note {
                font-size: 10px;
                margin-top: 3px;
            }

            .lesson-edit-button,
            .no-print {
                display: none !important;
            }

            @media print {
                body {
                    padding: 0;
                }

                #schedulePrintArea {
                    width: 100% !important;
                }
            }
        </style>
    `;

    printWindow.document.open();

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>الجدول الدراسي الأسبوعي</title>

            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link
                href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
            >

            ${stylesheets}
            ${printStyles}
        </head>

        <body>
            ${clonedArea.outerHTML}

            <script>
                window.addEventListener("load", function () {
                    setTimeout(function () {
                        window.focus();
                        window.print();
                    }, 400);
                });

                window.addEventListener("afterprint", function () {
                    window.close();
                });
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

/* =========================================================
   إعادة ضبط الاختيارات والعرض
   ========================================================= */

function resetSelection() {
    selectedClassId = null;
    currentClass = null;
    currentLessons = [];

    loadRequestNumber++;

    resetScheduleDisplay();
}

function resetScheduleDisplay() {
    currentLessons = [];

    disablePrinting();

    if (scheduleBody) {
        scheduleBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    اختر المرحلة والصف والجنس والشعبة لعرض الجدول.
                </td>
            </tr>
        `;
    }

    const printSchoolName =
        document.getElementById("printSchoolName");

    const printClassInfo =
        document.getElementById("printClassInfo");

    const printWeekInfo =
        document.getElementById("printWeekInfo");

    if (printSchoolName) {
        printSchoolName.textContent = "";
    }

    if (printClassInfo) {
        printClassInfo.textContent = "";
    }

    if (printWeekInfo) {
        printWeekInfo.textContent = "";
    }
}
