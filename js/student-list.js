
"use strict";

/*
=================================================
 ILABRAT Students - Student List
 قائمة الطلاب - نسخة واجهة تجريبية

 ملاحظة:
 البيانات أدناه تجريبية فقط.
 سيتم ربط القائمة ببيانات Supabase بعد
 الانتهاء من بناء صفحات المشروع.
=================================================
*/

const demoStudents = [
    {
        code: "IL-2026-001",
        fullName: "أحمد علي حسن محمد",
        stage: "ابتدائية",
        grade: "الأول الابتدائي",
        section: "أ",
        username: "أحمد علي حسن محمد"
    },
    {
        code: "IL-2026-002",
        fullName: "زينب كريم عبد الله علي",
        stage: "ابتدائية",
        grade: "الثاني الابتدائي",
        section: "ب",
        username: "زينب كريم عبد الله علي"
    },
    {
        code: "IL-2026-003",
        fullName: "مصطفى حيدر جاسم عباس",
        stage: "ابتدائية",
        grade: "السادس الابتدائي",
        section: "أ",
        username: "مصطفى حيدر جاسم عباس"
    },
    {
        code: "IL-2026-004",
        fullName: "فاطمة قاسم نوري حسين",
        stage: "متوسطة",
        grade: "الأول المتوسط",
        section: "أ",
        username: "فاطمة قاسم نوري حسين"
    },
    {
        code: "IL-2026-005",
        fullName: "حسن مهدي فاضل كريم",
        stage: "متوسطة",
        grade: "الثالث المتوسط",
        section: "ج",
        username: "حسن مهدي فاضل كريم"
    },
    {
        code: "IL-2026-006",
        fullName: "مريم سعدون صباح جبار",
        stage: "إعدادية",
        grade: "الرابع الإعدادي",
        section: "ب",
        username: "مريم سعدون صباح جبار"
    },
    {
        code: "IL-2026-007",
        fullName: "علي رائد كاظم حميد",
        stage: "إعدادية",
        grade: "الخامس الإعدادي",
        section: "أ",
        username: "علي رائد كاظم حميد"
    },
    {
        code: "IL-2026-008",
        fullName: "نور حيدر سلمان عبد",
        stage: "إعدادية",
        grade: "السادس الإعدادي",
        section: "ج",
        username: "نور حيدر سلمان عبد"
    }
];


/* =========================================
   عناصر الصفحة
========================================= */

const $ = (id) => document.getElementById(id);

const searchInput = $("studentSearchInput");
const stageFilter = $("stageFilter");
const gradeFilter = $("gradeFilter");
const sectionFilter = $("sectionFilter");
const sortFilter = $("sortFilter");

const tableBody = $("studentsTableBody");
const mobileList = $("mobileStudentList");
const emptyState = $("emptyState");
const toast = $("toastMessage");

let toastTimer;


/* =========================================
   توحيد النص العربي لتسهيل البحث
========================================= */

function normalizeArabic(value) {
    return String(value ?? "")
        .toLocaleLowerCase("ar")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[ًٌٍَُِّْـ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================
   حماية النصوص عند عرضها داخل HTML
========================================= */

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}


/* =========================================
   رسائل التنبيه
========================================= */

function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2300);
}


/* =========================================
   تحديث خيارات الصفوف بحسب المرحلة
========================================= */

function populateGrades() {
    const currentStage = stageFilter.value;
    const previousGrade = gradeFilter.value;

    const grades = [
        ...new Set(
            demoStudents
                .filter((student) => {
                    return !currentStage ||
                        student.stage === currentStage;
                })
                .map((student) => student.grade)
        )
    ];

    gradeFilter.innerHTML =
        '<option value="">كل الصفوف</option>' +
        grades.map((grade) => {
            return `
                <option value="${escapeHtml(grade)}">
                    ${escapeHtml(grade)}
                </option>
            `;
        }).join("");

    if (grades.includes(previousGrade)) {
        gradeFilter.value = previousGrade;
    }
}


/* =========================================
   البحث والتصفية
========================================= */

function getFilteredStudents() {
    const query = normalizeArabic(searchInput.value);

    const selectedStage = stageFilter.value;
    const selectedGrade = gradeFilter.value;
    const selectedSection = sectionFilter.value;

    const filteredStudents = demoStudents.filter((student) => {

        const matchesSearch =
            !query ||
            normalizeArabic(student.fullName).includes(query) ||
            normalizeArabic(student.code).includes(query) ||
            normalizeArabic(student.username).includes(query);

        const matchesStage =
            !selectedStage ||
            student.stage === selectedStage;

        const matchesGrade =
            !selectedGrade ||
            student.grade === selectedGrade;

        const matchesSection =
            !selectedSection ||
            student.section === selectedSection;

        return (
            matchesSearch &&
            matchesStage &&
            matchesGrade &&
            matchesSection
        );
    });

    const sortBy = sortFilter.value;

    filteredStudents.sort((a, b) => {
        if (sortBy === "code") {
            return a.code.localeCompare(b.code, "en");
        }

        if (sortBy === "grade") {
            return a.grade.localeCompare(b.grade, "ar");
        }

        return a.fullName.localeCompare(b.fullName, "ar");
    });

    return filteredStudents;
}


/* =========================================
   إنشاء صف الطالب بجدول الكمبيوتر
========================================= */

function studentRow(student) {
    const firstLetter = [...student.fullName][0] || "ط";

    return `
        <tr>
            <td>
                <button
                    class="student-code"
                    type="button"
                    data-copy="${escapeHtml(student.code)}"
                    title="نسخ كود الطالب">
                    ${escapeHtml(student.code)}
                </button>
            </td>

            <td>
                <div class="student-name-cell">
                    <span class="student-avatar">
                        ${escapeHtml(firstLetter)}
                    </span>

                    <div class="student-name-text">
                        <strong>
                            ${escapeHtml(student.fullName)}
                        </strong>

                        <small>بيانات تجريبية</small>
                    </div>
                </div>
            </td>

            <td>
                <span class="stage-pill">
                    ${escapeHtml(student.stage)}
                </span>
            </td>

            <td>
                <div class="class-cell">
                    <strong>
                        ${escapeHtml(student.grade)}
                    </strong>

                    <small>
                        الشعبة ${escapeHtml(student.section)}
                    </small>
                </div>
            </td>

            <td>
                <span class="username-text">
                    ${escapeHtml(student.username)}
                </span>
            </td>

            <td>
                <div class="row-actions">
                    <button
                        class="icon-action"
                        type="button"
                        data-copy="${escapeHtml(student.code)}"
                        title="نسخ كود الطالب"
                        aria-label="نسخ كود الطالب">
                        ▣
                    </button>

                    <button
                        class="icon-action"
                        type="button"
                        data-copy="${escapeHtml(student.fullName)}"
                        title="نسخ اسم الطالب"
                        aria-label="نسخ اسم الطالب">
                        ♧
                    </button>
                </div>
            </td>
        </tr>
    `;
}


/* =========================================
   إنشاء بطاقة الطالب للموبايل
========================================= */

function mobileStudentCard(student) {
    const firstLetter = [...student.fullName][0] || "ط";

    return `
        <article class="mobile-student-card">

            <div class="mobile-card-head">

                <div class="student-name-cell">
                    <span class="student-avatar">
                        ${escapeHtml(firstLetter)}
                    </span>

                    <div class="student-name-text">
                        <strong>
                            ${escapeHtml(student.fullName)}
                        </strong>

                        <small>
                            ${escapeHtml(student.stage)}
                        </small>
                    </div>
                </div>

                <button
                    class="student-code"
                    type="button"
                    data-copy="${escapeHtml(student.code)}">
                    ${escapeHtml(student.code)}
                </button>

            </div>

            <div class="mobile-card-details">

                <div class="mobile-detail">
                    <span>الصف والشعبة</span>

                    <strong>
                        ${escapeHtml(student.grade)}
                        — ${escapeHtml(student.section)}
                    </strong>
                </div>

                <div class="mobile-detail">
                    <span>اسم الدخول</span>

                    <strong>
                        ${escapeHtml(student.username)}
                    </strong>
                </div>

            </div>

            <div class="mobile-card-actions">

                <button
                    type="button"
                    data-copy="${escapeHtml(student.fullName)}">
                    نسخ الاسم
                </button>

                <button
                    type="button"
                    data-copy="${escapeHtml(student.code)}">
                    نسخ الكود
                </button>

            </div>

        </article>
    `;
}


/* =========================================
   عرض النتائج وتحديث الإحصائيات
========================================= */

function renderStudents() {
    const students = getFilteredStudents();

    tableBody.innerHTML = students
        .map(studentRow)
        .join("");

    mobileList.innerHTML = students
        .map(mobileStudentCard)
        .join("");

    emptyState.hidden = students.length > 0;

    $("totalStudents").textContent = students.length;

    $("resultCount").textContent = students.length;

    $("visibleCount").textContent = students.length;

    $("stageCount").textContent = new Set(
        students.map((student) => student.stage)
    ).size;

    $("tableSummary").textContent = students.length
        ? `عرض ${students.length} من ${demoStudents.length} طلاب`
        : "لا توجد نتائج";
}


/* =========================================
   إعادة ضبط عوامل البحث
========================================= */

function resetFilters() {
    searchInput.value = "";
    stageFilter.value = "";
    sectionFilter.value = "";
    sortFilter.value = "name";

    populateGrades();

    gradeFilter.value = "";

    renderStudents();
}


/* =========================================
   نسخ الاسم أو كود الطالب
========================================= */

async function copyText(value) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
        } else {
            const helper = document.createElement("textarea");

            helper.value = value;
            helper.style.position = "fixed";
            helper.style.opacity = "0";

            document.body.appendChild(helper);

            helper.select();

            const success = document.execCommand("copy");

            helper.remove();

            if (!success) {
                throw new Error("تعذر النسخ");
            }
        }

        showToast("تم نسخ البيانات");
    } catch (error) {
        showToast("تعذر النسخ تلقائيًا");
    }
}


/* =========================================
   ربط الأحداث
========================================= */

searchInput.addEventListener("input", renderStudents);

stageFilter.addEventListener("change", () => {
    populateGrades();
    renderStudents();
});

gradeFilter.addEventListener("change", renderStudents);

sectionFilter.addEventListener("change", renderStudents);

sortFilter.addEventListener("change", renderStudents);

$("resetFiltersButton").addEventListener("click", resetFilters);

$("emptyResetButton").addEventListener("click", resetFilters);


/* التعامل مع أزرار النسخ داخل الجدول والبطاقات */

document.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy]");

    if (copyButton) {
        copyText(copyButton.getAttribute("data-copy"));
    }
});


/* فتح وإغلاق القائمة الجانبية على الهاتف */

$("mobileMenuButton").addEventListener("click", () => {
    $("studentsSidebar").classList.toggle("open");
});

document.addEventListener("click", (event) => {
    const sidebar = $("studentsSidebar");

    if (
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !event.target.closest("#mobileMenuButton")
    ) {
        sidebar.classList.remove("open");
    }
});


/* =========================================
   تشغيل الصفحة
========================================= */

populateGrades();
renderStudents();
