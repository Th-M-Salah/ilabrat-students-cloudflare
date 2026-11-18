
"use strict";

/* =========================================================
   ILABRAT — إدارة الجدول الدراسي عبر Supabase
   إنشاء الشعب وإضافة الحصص وتعديلها وحذفها وحفظها ونشرها
   ========================================================= */

const DAYS = [
    { id: "sun", name: "الأحد" },
    { id: "mon", name: "الاثنين" },
    { id: "tue", name: "الثلاثاء" },
    { id: "wed", name: "الأربعاء" },
    { id: "thu", name: "الخميس" }
];

const DEFAULT_STAGE_GRADES = {
    "ابتدائية": [
        "الأول الابتدائي",
        "الثاني الابتدائي",
        "الثالث الابتدائي",
        "الرابع الابتدائي",
        "الخامس الابتدائي",
        "السادس الابتدائي"
    ],
    "متوسطة": [
        "الأول المتوسط",
        "الثاني المتوسط",
        "الثالث المتوسط"
    ],
    "إعدادية": [
        "الرابع الإعدادي",
        "الخامس الإعدادي",
        "السادس الإعدادي"
    ]
};

const $ = id => document.getElementById(id);
const db = window.supabaseClient;

let currentUser = null;
let currentProfile = null;
let currentSchool = null;

let allClasses = [];
let lessons = [];
let schoolTeachers = [];

let originalDbIds = new Set();
let isBusy = false;
let toastTimer = null;
let loadToken = 0;

/* =========================================================
   أدوات عامة
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function normalizeTime(value) {
    return String(value || "").slice(0, 5);
}

function makeLocalId() {
    return `new-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function isDatabaseId(id) {
    return /^\d+$/.test(String(id));
}

function selectedYear() {
    return $("yearSelect").value;
}

function selectedStage() {
    return $("stageSelect").value;
}

function selectedGrade() {
    return $("classSelect").value;
}

function selectedGender() {
    return $("genderSelect").value;
}

function selectedSection() {
    return $("sectionSelect").value;
}

function currentClass() {
    const value = selectedSection();

    return allClasses.find(item =>
        String(item.id) === String(value) ||
        (
            item.stage === selectedStage() &&
            item.grade_name === selectedGrade() &&
            item.gender === selectedGender() &&
            item.section_name === value
        )
    ) || null;
}

function showToast(message) {
    $("toastMessage").textContent = message;
    $("toastMessage").classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        $("toastMessage").classList.remove("show");
    }, 3500);
}

function showError(message) {
    $("connectionNotice").textContent = message;
    $("saveMessage").textContent = message;
}

function setStatus(isPublished, label = "") {
    $("publishStatus").classList.toggle("published", Boolean(isPublished));

    $("publishStatus").innerHTML = isPublished
        ? `<span></span> ${escapeHTML(label || "منشور للطلاب")}`
        : "<span></span> مسودة غير منشورة";

    $("publishScheduleButton").innerHTML = isPublished
        ? "<span>↗</span> إعادة النشر"
        : "<span>↗</span> نشر الجدول";
}

function setBusy(value) {
    isBusy = Boolean(value);

    [
        "stageSelect",
        "classSelect",
        "genderSelect",
        "sectionSelect",
        "yearSelect",
        "addLessonButton",
        "saveScheduleButton",
        "publishScheduleButton",
        "publishBottomButton",
        "confirmClassButton"
    ].forEach(id => {
        if ($(id)) $(id).disabled = isBusy;
    });

    if (!isBusy) updateSelectionControls();
}

function updateSelectionControls() {
    if (!$("stageSelect") || !$("sectionSelect")) return;

    const hasStageOptions = Array.from($("stageSelect").options)
        .some(option => Boolean(option.value));

    const hasStage = Boolean(selectedStage());
    const hasGrade = Boolean(selectedGrade());
    const hasGender = Boolean(selectedGender());
    const hasSection = Boolean(selectedSection());
    const hasClass = Boolean(currentClass());

    $("stageSelect").disabled = isBusy || !currentSchool || !hasStageOptions;
    $("classSelect").disabled = isBusy || !hasStage;
    $("genderSelect").disabled = isBusy || !hasGrade;
    $("sectionSelect").disabled = isBusy || !hasGender;

    $("confirmClassButton").disabled =
        isBusy ||
        !currentSchool ||
        !hasStage ||
        !hasGrade ||
        !hasGender ||
        !hasSection;

    $("addLessonButton").disabled = isBusy || !hasClass;
    $("saveScheduleButton").disabled = isBusy || !hasClass;
    $("publishScheduleButton").disabled = isBusy || !hasClass;
    $("publishBottomButton").disabled = isBusy || !hasClass;
}

function getStageName(stage) {
    return ({
        primary: "ابتدائية",
        middle: "متوسطة",
        preparatory: "إعدادية"
    })[stage] || stage || "";
}

/* =========================================================
   المواد الدراسية
   ========================================================= */

function updateCustomSubjectField(focusInput = false) {
    const custom = $("lessonSubject").value === "أخرى";

    $("customSubjectField").hidden = !custom;
    $("customSubjectInput").required = custom;

    if (!custom) {
        $("customSubjectInput").value = "";
    } else if (focusInput) {
        $("customSubjectInput").focus();
    }
}

function prepareSubjectField(subject = "") {
    const select = $("lessonSubject");
    const customInput = $("customSubjectInput");

    const standard = Array.from(select.options)
        .map(option => option.value)
        .filter(value => value && value !== "أخرى");

    if (!subject) {
        select.value = "";
        customInput.value = "";
    } else if (standard.includes(subject)) {
        select.value = subject;
        customInput.value = "";
    } else {
        select.value = "أخرى";
        customInput.value = subject === "أخرى" ? "" : subject;
    }

    updateCustomSubjectField();
}

function getLessonSubjectValue() {
    return $("lessonSubject").value === "أخرى"
        ? $("customSubjectInput").value.trim()
        : $("lessonSubject").value.trim();
}

/* =========================================================
   منع تعارض حصص المعلم بين جميع شعب المدرسة
   ========================================================= */

function normalizeTeacherName(value) {
    return String(value || "")
        .normalize("NFC")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("ar");
}

function timeToMinutes(value) {
    const time = normalizeTime(value);
    const match = /^(\d{2}):(\d{2})$/.exec(time);

    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
}

function lessonsOverlap(first, second) {
    if (
        first.day_of_week !== second.day_of_week &&
        first.day !== second.day
    ) {
        return false;
    }

    if (Number(first.period) === Number(second.period)) {
        return true;
    }

    const firstStart = timeToMinutes(
        first.start_time ?? first.start
    );

    const firstEnd = timeToMinutes(
        first.end_time ?? first.end
    );

    const secondStart = timeToMinutes(
        second.start_time ?? second.start
    );

    const secondEnd = timeToMinutes(
        second.end_time ?? second.end
    );

    if (
        firstStart !== null &&
        firstEnd !== null &&
        secondStart !== null &&
        secondEnd !== null
    ) {
        return firstStart < secondEnd &&
            secondStart < firstEnd;
    }

    return false;
}

async function validateTeacherConflicts(classItem) {
    const { data: existingLessons, error } = await db
        .from("timetable_lessons")
        .select(`
            id,
            class_id,
            day_of_week,
            period,
            subject,
            teacher_name,
            start_time,
            end_time
        `)
        .eq("school_id", currentSchool.id)
        .eq("academic_year", selectedYear());

    if (error) {
        console.error("Teacher conflict lookup error:", error);

        throw new Error(
            "تعذر التحقق من تعارض حصص المعلمين. لم يتم حفظ الجدول."
        );
    }

    const otherClasses = (existingLessons || []).filter(item =>
        String(item.class_id) !== String(classItem.id)
    );

    const proposedLessons = lessons.map(item => ({
        ...item,
        day_of_week: item.day,
        teacher_name: item.teacher,
        start_time: item.start,
        end_time: item.end,
        class_id: classItem.id
    }));

    for (const proposed of proposedLessons) {
        const teacherName = normalizeTeacherName(
            proposed.teacher_name
        );

        if (!teacherName) continue;

        for (const existing of otherClasses) {
            if (
                normalizeTeacherName(existing.teacher_name) !==
                teacherName
            ) {
                continue;
            }

            if (!lessonsOverlap(proposed, existing)) {
                continue;
            }

            const conflictingClass = allClasses.find(item =>
                String(item.id) === String(existing.class_id)
            );

            const className = conflictingClass
                ? `${conflictingClass.grade_name} - ${conflictingClass.gender} - الشعبة ${conflictingClass.section_name}`
                : `الشعبة رقم ${existing.class_id}`;

            const dayName =
                DAYS.find(day =>
                    day.id === proposed.day_of_week
                )?.name || proposed.day_of_week;

            return {
                valid: false,
                message:
                    `لا يمكن حفظ الجدول: المعلم "${proposed.teacher_name}" لديه حصة متعارضة في ${className} يوم ${dayName}، الحصة رقم ${existing.period}.`
            };
        }
    }

    for (let i = 0; i < proposedLessons.length; i++) {
        for (let j = i + 1; j < proposedLessons.length; j++) {
            const first = proposedLessons[i];
            const second = proposedLessons[j];

            if (
                normalizeTeacherName(first.teacher_name) !==
                normalizeTeacherName(second.teacher_name)
            ) {
                continue;
            }

            if (!lessonsOverlap(first, second)) continue;

            const dayName =
                DAYS.find(day =>
                    day.id === first.day_of_week
                )?.name || first.day_of_week;

            return {
                valid: false,
                message:
                    `المعلم "${first.teacher_name}" لديه حصتان متعارضتان في الشعبة الحالية يوم ${dayName}.`
            };
        }
    }

    return { valid: true };
}

/* =========================================================
   تسجيل الدخول والصلاحيات
   ========================================================= */

async function initializePage() {
    $("resetDemoButton").hidden = true;

    if (!db?.auth || !db?.from) {
        showError("تعذر العثور على Supabase Client. تحقق من supabase-config.js.");
        $("weeklySchedule").innerHTML =
            '<div class="schedule-loading">تعذر الاتصال بقاعدة البيانات.</div>';
        return;
    }

    setBusy(true);

    try {
        const { data: authData, error: authError } =
            await db.auth.getUser();

        if (authError) throw authError;

        currentUser = authData?.user || null;

        if (!currentUser) {
            window.location.replace("index.html");
            return;
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error("لا يوجد ملف صلاحيات مرتبط بهذا الحساب.");

        currentProfile = profile;

        const role = String(profile.role || "").toLowerCase();

        if (role === "admin") {
            window.location.replace("main-admin.html");
            return;
        }

        if (role !== "school_admin") {
            throw new Error("ليس لديك صلاحية إدارة الجداول الدراسية.");
        }

        $("adminDisplayName").textContent =
            profile.full_name || "الإدارة";

        await loadCurrentSchool();
        await loadClasses();
        await loadSchoolTeachers();

        $("connectionNotice").textContent =
            `تم الاتصال بقاعدة البيانات. المدرسة المحددة: ${currentSchool.name}`;

        $("saveMessage").textContent =
            "تم الاتصال بقاعدة البيانات بنجاح.";

        setStatus(false);

    } catch (error) {
        console.error("Initialize timetable error:", error);

        showError(error.message || "تعذر تحميل صفحة إدارة الجدول.");

        $("weeklySchedule").innerHTML =
            '<div class="schedule-loading">تعذر تحميل بيانات الجدول.</div>';
    } finally {
        setBusy(false);
    }
}

/* =========================================================
   المدرسة الحالية
   ========================================================= */

async function loadCurrentSchool() {
    const { data: memberships, error } = await db
        .from("school_memberships")
        .select("school_id")
        .eq("profile_id", currentUser.id)
        .eq("role", "school_admin");

    if (error) throw error;

    if (!memberships?.length) {
        throw new Error("هذا الحساب غير مرتبط بمدرسة بصلاحية مدير مدرسة.");
    }

    const ids = [...new Set(
        memberships.map(item => String(item.school_id))
    )];

    if (ids.length !== 1) {
        throw new Error("هذا الحساب مرتبط بأكثر من مدرسة. يلزم تحديد المدرسة من لوحة الإدارة.");
    }

    const { data: school, error: schoolError } = await db
        .from("schools")
        .select("id, name")
        .eq("id", ids[0])
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) throw new Error("تعذر العثور على المدرسة المرتبطة بالحساب.");

    currentSchool = school;
    $("schoolDisplayName").textContent = school.name || "المدرسة";

    return true;
}

/* =========================================================
   الصفوف والشعب
   ========================================================= */

async function loadClasses() {
    const { data, error } = await db
        .from("classes")
        .select("id, name, school_id, stage, grade_name, gender, section_name")
        .eq("school_id", currentSchool.id)
        .order("id", { ascending: true });

    if (error) throw error;

    allClasses = (data || []).map(item => ({
        ...item,
        stage: item.stage || "",
        grade_name: item.grade_name || item.name || "",
        gender: item.gender || "",
        section_name: item.section_name || ""
    }));

    populateStageOptions();
}

function getAllStageOptions() {
    return [...new Set([
        ...Object.keys(DEFAULT_STAGE_GRADES),
        ...allClasses.map(item => item.stage).filter(Boolean)
    ])];
}

function getGradesForStage(stage) {
    const defaults = DEFAULT_STAGE_GRADES[stage] || [];

    const registered = allClasses
        .filter(item => item.stage === stage)
        .map(item => item.grade_name)
        .filter(Boolean);

    return [...new Set([...defaults, ...registered])];
}

function populateStageOptions(preferredStage = "") {
    const select = $("stageSelect");
    const stages = getAllStageOptions();

    select.innerHTML =
        '<option value="">اختر المرحلة الدراسية</option>' +
        stages.map(stage =>
            `<option value="${escapeHTML(stage)}">${escapeHTML(getStageName(stage))}</option>`
        ).join("");

    select.value = stages.includes(preferredStage) ? preferredStage : "";

    $("classSelect").innerHTML =
        '<option value="">اختر المرحلة أولًا</option>';

    $("genderSelect").value = "";

    $("sectionSelect").innerHTML =
        '<option value="">اختر الصف والجنس أولًا</option>';

    lessons = [];
    originalDbIds.clear();

    updateSelectedClassLabel();
    renderSchedule();
    updateSelectionControls();
}

function populateGradeOptions(preferredGrade = "") {
    const grades = getGradesForStage(selectedStage());

    $("classSelect").innerHTML =
        '<option value="">اختر الصف الدراسي</option>' +
        grades.map(grade =>
            `<option value="${escapeHTML(grade)}">${escapeHTML(grade)}</option>`
        ).join("");

    $("classSelect").value =
        grades.includes(preferredGrade) ? preferredGrade : "";

    $("genderSelect").value = "";

    $("sectionSelect").innerHTML =
        '<option value="">اختر الجنس أولًا</option>';

    lessons = [];
    originalDbIds.clear();

    updateSelectedClassLabel();
    renderSchedule();
    updateSelectionControls();
}

function populateSectionOptions(preferredGender = "") {
    const rows = allClasses.filter(item =>
        item.stage === selectedStage() &&
        item.grade_name === selectedGrade()
    );

    const genders = [...new Set(
        rows.map(item => item.gender).filter(Boolean)
    )];

    $("genderSelect").innerHTML =
        '<option value="">اختر الجنس</option>' +
        '<option value="بنين">بنين</option>' +
        '<option value="بنات">بنات</option>' +
        '<option value="مختلط">مختلط</option>';

    $("genderSelect").value =
        ["بنين", "بنات", "مختلط"].includes(preferredGender)
            ? preferredGender
            : (genders.length === 1 ? genders[0] : "");

    populateSectionSelect();
}

function populateSectionSelect(preferredSection = "") {
    const rows = allClasses.filter(item =>
        item.stage === selectedStage() &&
        item.grade_name === selectedGrade() &&
        item.gender === selectedGender()
    );

    const sectionLetters = [
        "أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي",
        "ك", "ل", "م", "ن", "س", "ع", "ف", "ص", "ق", "ر",
        "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"
    ];

    const select = $("sectionSelect");

    if (!selectedGender()) {
        select.innerHTML = '<option value="">اختر الجنس أولًا</option>';
        lessons = [];
        updateSelectedClassLabel();
        renderSchedule();
        return;
    }

    const letters = [...new Set([
        ...sectionLetters,
        ...rows.map(item => item.section_name).filter(Boolean)
    ])];

    select.innerHTML =
        '<option value="">اختر الشعبة</option>' +
        letters.map(letter => {
            const exists = rows.some(
                item => item.section_name === letter
            );

            return `
                <option value="${escapeHTML(letter)}">
                    الشعبة ${escapeHTML(letter)}${exists ? "" : " (جديدة)"}
                </option>
            `;
        }).join("");

    select.value = preferredSection || "";

    lessons = [];
    originalDbIds.clear();

    updateSelectedClassLabel();
    renderSchedule();
    updateSelectionControls();
}

async function insertClassRecord(stage, grade, gender, sectionName) {
    const duplicate = allClasses.find(item =>
        item.stage === stage &&
        item.grade_name === grade &&
        item.gender === gender &&
        item.section_name === sectionName
    );

    if (duplicate) return duplicate;

    const { data, error } = await db
        .from("classes")
        .insert({
            school_id: currentSchool.id,
            name: `${grade} - ${gender} - ${sectionName}`,
            stage,
            grade_name: grade,
            gender,
            section_name: sectionName
        })
        .select("id, name, school_id, stage, grade_name, gender, section_name")
        .single();

    if (error) throw error;

    return data;
}

/* =========================================================
   إنشاء الشعبة
   ========================================================= */

async function confirmClassCreation() {
    if (isBusy) return;

    const stage = selectedStage();
    const grade = selectedGrade();
    const gender = selectedGender();
    const sectionName = selectedSection();

    if (!stage || !grade || !gender || !sectionName) {
        showToast("يرجى اختيار المرحلة والصف والجنس والشعبة أولًا.");
        return;
    }

    const duplicate = allClasses.find(item =>
        item.stage === stage &&
        item.grade_name === grade &&
        item.gender === gender &&
        item.section_name === sectionName
    );

    if (duplicate) {
        showToast("هذه الشعبة موجودة بالفعل.");
        await loadSchedule();
        return;
    }

    setBusy(true);

    try {
        await insertClassRecord(stage, grade, gender, sectionName);

        const { data, error } = await db
            .from("classes")
            .select("id, name, school_id, stage, grade_name, gender, section_name")
            .eq("school_id", currentSchool.id)
            .order("id", { ascending: true });

        if (error) throw error;

        allClasses = (data || []).map(item => ({
            ...item,
            stage: item.stage || "",
            grade_name: item.grade_name || item.name || "",
            gender: item.gender || "",
            section_name: item.section_name || ""
        }));

        populateStageOptions();

        lessons = [];
        originalDbIds.clear();

        setStatus(false);
        updateSelectedClassLabel();
        renderSchedule();

        $("saveMessage").textContent = "تم إنشاء الشعبة بنجاح.";

        showToast(
            `تم إنشاء ${grade} - ${gender} - الشعبة ${sectionName} بنجاح.`
        );

    } catch (error) {
        console.error("Create section error:", error);

        showToast(error.message || "تعذر إنشاء الشعبة.");

    } finally {
        setBusy(false);
    }
}

/* =========================================================
   المعلمون
   ========================================================= */

async function loadSchoolTeachers() {
    const { data: memberships, error } = await db
        .from("school_memberships")
        .select("profile_id")
        .eq("school_id", currentSchool.id)
        .eq("role", "teacher");

    if (error) throw error;

    const profileIds = [...new Set(
        (memberships || [])
            .map(item => item.profile_id)
            .filter(Boolean)
    )];

    if (!profileIds.length) {
        schoolTeachers = [];
        populateTeacherOptions();
        return;
    }

    const { data: profiles, error: profilesError } = await db
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds)
        .order("full_name", { ascending: true });

    if (profilesError) throw profilesError;

    schoolTeachers = (profiles || [])
        .filter(profile => profile.full_name)
        .map(profile => ({
            id: profile.id,
            name: profile.full_name
        }));

    populateTeacherOptions();
}

function populateTeacherOptions(selectedTeacher = "") {
    const select = $("lessonTeacher");
    if (!select) return;

    const currentValue = selectedTeacher || select.value;

    select.innerHTML = '<option value="">اختر المعلم</option>';

    if (!schoolTeachers.length) {
        select.innerHTML =
            '<option value="">لا يوجد معلمون مسجلون في هذه المدرسة</option>';

        select.disabled = true;
        return;
    }

    schoolTeachers.forEach(teacher => {
        const option = document.createElement("option");
        option.value = teacher.name;
        option.textContent = teacher.name;
        select.appendChild(option);
    });

    if (
        currentValue &&
        !schoolTeachers.some(teacher => teacher.name === currentValue)
    ) {
        const oldOption = document.createElement("option");
        oldOption.value = currentValue;
        oldOption.textContent = `${currentValue} (اسم محفوظ سابقًا)`;
        select.appendChild(oldOption);
    }

    select.value = currentValue || "";
    select.disabled = false;
}

/* =========================================================
   اختيار الشعبة وتحميل جدولها
   ========================================================= */

function updateSelectedClassLabel() {
    const item = currentClass();

    if (!item) {
        $("selectedClassLabel").textContent = "لم يتم تحديد شعبة";
        $("lessonCount").textContent = "0 حصة";
    } else {
        $("selectedClassLabel").textContent =
            `${item.grade_name} · ${item.gender} · الشعبة ${item.section_name}`;
    }

    updateSelectionControls();
}

async function handleSectionChange() {
    lessons = [];
    originalDbIds.clear();

    updateSelectedClassLabel();
    renderSchedule();

    if (currentClass()) {
        await loadSchedule();
    } else {
        setStatus(false);
        updateSelectionControls();
    }
}

async function loadSchedule(options = {}) {
    const manageBusy = options.manageBusy !== false;
    const classItem = currentClass();

    if (!classItem || !currentSchool) {
        lessons = [];
        originalDbIds.clear();
        renderSchedule();
        updateSelectedClassLabel();
        return;
    }

    const token = ++loadToken;

    if (manageBusy) setBusy(true);

    try {
        const { data, error } = await db
            .from("timetable_lessons")
            .select("*")
            .eq("school_id", currentSchool.id)
            .eq("class_id", classItem.id)
            .eq("academic_year", selectedYear())
            .order("period", { ascending: true });

        if (error) throw error;

        if (token !== loadToken) return;

        lessons = (data || []).map(item => ({
            id: String(item.id),
            day: item.day_of_week,
            period: Number(item.period),
            subject: item.subject || "",
            teacher: item.teacher_name || "",
            start: normalizeTime(item.start_time),
            end: normalizeTime(item.end_time),
            note: item.note || "",
            isPublished: Boolean(item.is_published)
        }));

        originalDbIds = new Set(
            lessons
                .filter(item => isDatabaseId(item.id))
                .map(item => String(item.id))
        );

        const isPublished = lessons.length > 0 &&
            lessons.every(item => item.isPublished);

        setStatus(isPublished);

        renderSchedule();
        updateSelectedClassLabel();

    } catch (error) {
        console.error("Load schedule error:", error);
        showToast(error.message || "تعذر تحميل الجدول.");
    } finally {
        if (manageBusy) setBusy(false);
    }
}

/* =========================================================
   عرض الجدول الأسبوعي
   ========================================================= */

function renderSchedule() {
    const container = $("weeklySchedule");
    if (!container) return;

    if (!currentClass()) {
        container.innerHTML =
            '<div class="schedule-loading">اختر المرحلة والصف والجنس والشعبة لعرض الجدول.</div>';

        $("lessonCount").textContent = "0 حصة";
        return;
    }

    $("lessonCount").textContent = `${lessons.length} حصة`;

    container.innerHTML = DAYS.map(day => {
        const dayLessons = lessons
            .filter(item => item.day === day.id)
            .sort((a, b) => a.period - b.period);

        return `
            <div class="day-column">
                <div class="day-header">
                    <h3>${escapeHTML(day.name)}</h3>
                    <button
                        type="button"
                        class="add-day-button"
                        data-add-day="${day.id}">
                        + إضافة حصة
                    </button>
                </div>

                <div class="day-lessons">
                    ${
                        dayLessons.length
                            ? dayLessons.map(item => `
                                <article class="lesson-card">

                                    <div class="lesson-period">
                                        <span>الحصة ${escapeHTML(item.period)}</span>
                                    </div>

                                    <p class="lesson-subject">
                                        ${escapeHTML(item.subject)}
                                    </p>

                                    <p class="lesson-teacher">
                                        ${escapeHTML(item.teacher)}
                                    </p>

                                    <div class="lesson-time">
                                        ${escapeHTML(item.start)} - ${escapeHTML(item.end)}
                                    </div>

                                    ${
                                        item.note
                                            ? `<div class="lesson-note">${escapeHTML(item.note)}</div>`
                                            : ""
                                    }

                                    <div class="lesson-card-actions">
                                        <button
                                            type="button"
                                            class="lesson-action-btn lesson-edit-btn"
                                            data-edit-id="${escapeHTML(item.id)}">
                                            ✎ تعديل
                                        </button>

                                        <button
                                            type="button"
                                            class="lesson-action-btn lesson-delete-btn"
                                            data-delete-id="${escapeHTML(item.id)}">
                                            × حذف
                                        </button>
                                    </div>
                                </article>
                            `).join("")
                            : `
                                <div class="empty-day">
                                    <b>＋</b>
                                    لا توجد حصص
                                </div>
                            `
                    }
                </div>
            </div>
        `;
    }).join("");
}

/* =========================================================
   حذف الحصة مباشرة من بطاقة الجدول
   الحذف محلي حتى الضغط على حفظ التغييرات
   ========================================================= */

function deleteLessonFromCard(id) {
    if (isBusy) return;

    const lesson = lessons.find(item =>
        String(item.id) === String(id)
    );

    if (!lesson) {
        showToast("تعذر العثور على الحصة المطلوبة.");
        return;
    }

    const dayName =
        DAYS.find(day => day.id === lesson.day)?.name || lesson.day;

    const confirmed = confirm(
        `هل أنت متأكد من حذف هذه الحصة؟\n\n` +
        `المادة: ${lesson.subject}\n` +
        `اليوم: ${dayName}\n` +
        `رقم الحصة: ${lesson.period}\n\n` +
        `سيتم تثبيت الحذف في قاعدة البيانات عند الضغط على «حفظ التغييرات».`
    );

    if (!confirmed) return;

    lessons = lessons.filter(item =>
        String(item.id) !== String(id)
    );

    setStatus(false);
    renderSchedule();
    updateSelectedClassLabel();

    $("saveMessage").textContent =
        "تم حذف الحصة من الجدول مؤقتًا. اضغط حفظ التغييرات لتثبيت الحذف في قاعدة البيانات.";

    showToast(
        `تم حذف حصة ${lesson.subject} من ${dayName}. اضغط حفظ التغييرات لتثبيت الحذف.`
    );
}

/* =========================================================
   نافذة إضافة وتعديل الحصة
   ========================================================= */

function ensureDeleteLessonButton() {
    if ($("deleteLessonButton")) return;

    const actions = $("lessonForm").querySelector(".modal-actions");
    if (!actions) return;

    const button = document.createElement("button");

    button.type = "button";
    button.id = "deleteLessonButton";
    button.className = "btn btn-secondary";
    button.textContent = "حذف الحصة";
    button.style.color = "#B43A42";
    button.style.marginLeft = "auto";
    button.hidden = true;

    button.addEventListener("click", deleteCurrentLesson);

    actions.prepend(button);
}

function openLessonModal(lesson = null, day = "sun") {
    if (!currentClass()) {
        showToast("اختر الشعبة أولًا.");
        return;
    }

    ensureDeleteLessonButton();

    $("lessonForm").reset();
    $("formError").textContent = "";

    $("lessonId").value = lesson?.id || "";

    $("modalTitle").textContent =
        lesson ? "تعديل الحصة" : "إضافة حصة جديدة";

    $("lessonDay").value = lesson?.day || day;
    $("lessonPeriod").value = String(lesson?.period || 1);

    prepareSubjectField(lesson?.subject || "");
    populateTeacherOptions(lesson?.teacher || "");

    $("lessonStart").value = lesson?.start || "08:00";
    $("lessonEnd").value = lesson?.end || "08:45";
    $("lessonNote").value = lesson?.note || "";

    $("deleteLessonButton").hidden = !lesson;

    $("lessonModal").hidden = false;
    document.body.classList.add("modal-open");
}

function closeLessonModal() {
    $("lessonModal").hidden = true;
    document.body.classList.remove("modal-open");
    $("formError").textContent = "";
}

/* =========================================================
   إضافة وتعديل الحصص
   ========================================================= */

function handleLessonSubmit(event) {
    event.preventDefault();

    if (isBusy) return;

    const subject = getLessonSubjectValue();
    const teacher = $("lessonTeacher").value.trim();
    const start = $("lessonStart").value;
    const end = $("lessonEnd").value;

    if (!subject) {
        $("formError").textContent = "يرجى اختيار المادة الدراسية.";
        return;
    }

    if (!teacher) {
        $("formError").textContent = "يرجى اختيار المعلم.";
        return;
    }

    if (!start || !end || start >= end) {
        $("formError").textContent =
            "وقت نهاية الحصة يجب أن يكون بعد وقت بدايتها.";
        return;
    }

    const id = $("lessonId").value;
    const day = $("lessonDay").value;
    const period = Number($("lessonPeriod").value);

    const conflict = lessons.find(item =>
        item.id !== id &&
        item.day === day &&
        item.period === period
    );

    if (conflict) {
        $("formError").textContent =
            "توجد حصة أخرى في اليوم ورقم الحصة نفسيهما.";
        return;
    }

    const lessonData = {
        id: id || makeLocalId(),
        day,
        period,
        subject,
        teacher,
        start,
        end,
        note: $("lessonNote").value.trim(),
        isPublished: false
    };

    if (id) {
        lessons = lessons.map(item =>
            item.id === id ? lessonData : item
        );
    } else {
        lessons.push(lessonData);
    }

    closeLessonModal();
    setStatus(false);
    renderSchedule();
    updateSelectedClassLabel();

    $("saveMessage").textContent =
        "توجد تغييرات غير محفوظة. اضغط حفظ التغييرات.";

    showToast("تم تحديث الحصة. احفظ التغييرات لتثبيتها في قاعدة البيانات.");
}

/* =========================================================
   حذف الحصة من نافذة التعديل
   ========================================================= */

async function deleteCurrentLesson() {
    if (isBusy) return;

    const id = $("lessonId").value;

    if (!id) return;

    const lesson = lessons.find(item => item.id === id);
    if (!lesson) return;

    const dayName =
        DAYS.find(day => day.id === lesson.day)?.name || lesson.day;

    const confirmed = confirm(
        `هل تريد حذف حصة ${lesson.subject}؟\n` +
        `اليوم: ${dayName}\n` +
        `رقم الحصة: ${lesson.period}`
    );

    if (!confirmed) return;

    lessons = lessons.filter(item => item.id !== id);

    closeLessonModal();
    setStatus(false);
    renderSchedule();
    updateSelectedClassLabel();

    $("saveMessage").textContent =
        "تم حذف الحصة محليًا. اضغط حفظ التغييرات لتثبيت الحذف.";

    showToast("تم حذف الحصة من الجدول الحالي. احفظ التغييرات لتأكيد الحذف.");
}

/* =========================================================
   حفظ الجدول في Supabase
   ========================================================= */

async function saveSchedule(showMessage = true) {
    const classItem = currentClass();

    if (!classItem) {
        showToast("اختر الشعبة أولًا.");
        return false;
    }

    if (isBusy) return false;

    setBusy(true);

    try {
        const validation = await validateTeacherConflicts(classItem);

        if (!validation.valid) {
            showToast(validation.message);
            $("saveMessage").textContent = validation.message;

            return false;
        }

        const payloadBase = {
            school_id: currentSchool.id,
            class_id: classItem.id,
            academic_year: selectedYear()
        };

        const currentIds = new Set(
            lessons
                .filter(item => isDatabaseId(item.id))
                .map(item => String(item.id))
        );

        const idsToDelete = [...originalDbIds]
            .filter(id => !currentIds.has(id));

        if (idsToDelete.length) {
            const { error } = await db
                .from("timetable_lessons")
                .delete()
                .eq("school_id", currentSchool.id)
                .eq("class_id", classItem.id)
                .eq("academic_year", selectedYear())
                .in("id", idsToDelete);

            if (error) throw error;
        }

        for (const lesson of lessons) {
            const payload = {
                ...payloadBase,
                day_of_week: lesson.day,
                period: lesson.period,
                subject: lesson.subject,
                teacher_name: lesson.teacher,
                start_time: lesson.start,
                end_time: lesson.end,
                note: lesson.note || "",
                is_published: false
            };

            if (isDatabaseId(lesson.id)) {
                const { error } = await db
                    .from("timetable_lessons")
                    .update(payload)
                    .eq("id", lesson.id)
                    .eq("school_id", currentSchool.id)
                    .eq("class_id", classItem.id)
                    .eq("academic_year", selectedYear());

                if (error) throw error;

            } else {
                const { data, error } = await db
                    .from("timetable_lessons")
                    .insert(payload)
                    .select("id")
                    .single();

                if (error) throw error;

                lesson.id = String(data.id);
            }
        }

        const { error: unpublishError } = await db
            .from("timetable_lessons")
            .update({ is_published: false })
            .eq("school_id", currentSchool.id)
            .eq("class_id", classItem.id)
            .eq("academic_year", selectedYear());

        if (unpublishError) throw unpublishError;

        originalDbIds = new Set(
            lessons
                .filter(item => isDatabaseId(item.id))
                .map(item => String(item.id))
        );

        lessons.forEach(item => {
            item.isPublished = false;
        });

        setStatus(false);
        renderSchedule();

        if (showMessage) {
            $("saveMessage").textContent =
                "تم حفظ التغييرات في قاعدة البيانات كمسودة غير منشورة.";

            showToast("تم حفظ التغييرات في Supabase بنجاح.");
        }

        return true;

    } catch (error) {
        console.error("Save timetable error:", error);

        showToast(
            error.message || "تعذر حفظ الجدول. تحقق من صلاحيات RLS."
        );

        $("saveMessage").textContent =
            `لم يكتمل الحفظ: ${error.message || "خطأ غير معروف"}. أعد تحميل الجدول للتحقق من حالة البيانات.`;

        return false;

    } finally {
        setBusy(false);
    }
}

/* =========================================================
   نشر الجدول
   ========================================================= */

async function publishSchedule() {
    const classItem = currentClass();

    if (!classItem) {
        showToast("اختر الشعبة أولًا.");
        return;
    }

    if (!lessons.length) {
        showToast("أضف حصة واحدة على الأقل قبل نشر الجدول.");
        return;
    }

    if (isBusy) return;

    if (!confirm("هل تريد حفظ التغييرات ونشر هذا الجدول للطلاب؟")) {
        return;
    }

    const saved = await saveSchedule(false);

    if (!saved) return;

    setBusy(true);

    try {
        const { data, error } = await db
            .from("timetable_lessons")
            .update({ is_published: true })
            .eq("school_id", currentSchool.id)
            .eq("class_id", classItem.id)
            .eq("academic_year", selectedYear())
            .select("id");

        if (error) throw error;

        if (!data?.length) {
            throw new Error(
                "لم يتم نشر أي حصة. تحقق من صلاحيات التعديل في قاعدة البيانات."
            );
        }

        lessons.forEach(item => {
            item.isPublished = true;
        });

        setStatus(true, "منشور للطلاب");
        renderSchedule();

        $("saveMessage").textContent =
            "تم حفظ الجدول ونشره. يستطيع الطلاب المرتبطون بهذه الشعبة رؤيته وفق سياسات RLS.";

        showToast("تم نشر الجدول بنجاح.");

    } catch (error) {
        console.error("Publish timetable error:", error);
        showToast(error.message || "تعذر نشر الجدول.");
    } finally {
        setBusy(false);
    }
}

/* =========================================================
   أحداث الصفحة
   ========================================================= */

function bindEvents() {
    $("stageSelect").addEventListener("change", () => {
        populateGradeOptions();
    });

    $("classSelect").addEventListener("change", () => {
        populateSectionOptions();
    });

    $("genderSelect").addEventListener("change", () => {
        populateSectionSelect();
    });

    $("sectionSelect").addEventListener("change", handleSectionChange);

    $("confirmClassButton").addEventListener(
        "click",
        confirmClassCreation
    );

    $("yearSelect").addEventListener("change", () => {
        loadSchedule();
    });

    $("lessonSubject").addEventListener("change", () => {
        updateCustomSubjectField(true);
    });

    $("addLessonButton").addEventListener("click", () => {
        openLessonModal();
    });

    $("weeklySchedule").addEventListener("click", event => {
        const add = event.target.closest("[data-add-day]");

        if (add) {
            openLessonModal(null, add.dataset.addDay);
            return;
        }

        const deleteButton = event.target.closest("[data-delete-id]");

        if (deleteButton) {
            event.preventDefault();
            event.stopPropagation();

            deleteLessonFromCard(deleteButton.dataset.deleteId);
            return;
        }

        const editButton = event.target.closest("[data-edit-id]");

        if (editButton) {
            event.preventDefault();
            event.stopPropagation();

            const lesson = lessons.find(
                item => item.id === editButton.dataset.editId
            );

            if (lesson) openLessonModal(lesson);
        }
    });

    $("lessonForm").addEventListener("submit", handleLessonSubmit);

    $("closeModalButton").addEventListener("click", closeLessonModal);
    $("cancelModalButton").addEventListener("click", closeLessonModal);

    $("lessonModal").addEventListener("click", event => {
        if (event.target === $("lessonModal")) {
            closeLessonModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            !$("lessonModal").hidden
        ) {
            closeLessonModal();
        }
    });

    $("saveScheduleButton").addEventListener("click", () => {
        saveSchedule(true);
    });

    $("publishScheduleButton").addEventListener(
        "click",
        publishSchedule
    );

    $("publishBottomButton").addEventListener(
        "click",
        publishSchedule
    );

    $("resetDemoButton").addEventListener("click", () => {
        showToast(
            "بيانات المثال التجريبية متوقفة؛ لن نكتب بيانات وهمية في قاعدة بيانات المدرسة."
        );
    });
}

/* =========================================================
   بدء الصفحة
   ========================================================= */

bindEvents();
ensureDeleteLessonButton();
initializePage();
