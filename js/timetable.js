
"use strict";

/* =========================================================
   ILABRAT STUDENTS — STUDENT PORTAL
   Daily / Weekly / Account / School Announcements
   ========================================================= */

(() => {
    const db = window.supabaseClient || window.db;
    const $ = id => document.getElementById(id);

    const DAYS = [
        { id: "sun", name: "الأحد", color: "blue" },
        { id: "mon", name: "الاثنين", color: "teal" },
        { id: "tue", name: "الثلاثاء", color: "purple" },
        { id: "wed", name: "الأربعاء", color: "green" },
        { id: "thu", name: "الخميس", color: "orange" }
    ];

    const state = {
        user: null,
        student: null,
        profile: null,
        classItem: null,
        school: null,
        lessons: [],
        posts: [],
        postsError: "",
        currentDayIndex: 0,
        currentView: "daily",
        academicYear: ""
    };

    const elements = {
        welcomeStudentName: $("welcomeStudentName"),
        welcomeSchoolName: $("welcomeSchoolName"),
        accountContent: $("accountContent"),
        currentDayTitle: $("currentDayTitle"),
        currentDate: $("currentDate"),
        dayContent: $("dayContent"),
        dayPosition: $("dayPosition"),
        previousDay: $("previousDay"),
        nextDay: $("nextDay"),
        weeklyClassInfo: $("weeklyClassInfo"),

        // حاوية الجدول الأسبوعي
        weeklyContainer: document.querySelector(".weekly-table-wrapper"),

        announcementsContent: $("announcementsContent"),
        announcementCount: $("announcementCount"),
        imageViewer: $("imageViewer"),
        viewerImage: $("viewerImage"),
        viewerCaption: $("viewerCaption"),
        logoutButton: $("logoutButton")
    };

    /* -------------------- HELPERS -------------------- */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function formatArabicDigits(value) {
        return String(value).replace(/\d/g, digit =>
            "٠١٢٣٤٥٦٧٨٩"[Number(digit)]
        );
    }

    function normalizeTime(value) {
        return String(value || "").slice(0, 5);
    }

    function formatTime(value) {
        const time = normalizeTime(value);
        if (!/^\d{2}:\d{2}$/.test(time)) return "غير محدد";

        const [hourString, minute] = time.split(":");
        const hour = Number(hourString);
        const period = hour < 12 ? "صباحاً" : "مساءً";
        const displayHour = hour % 12 || 12;

        return `${formatArabicDigits(displayHour)}:${formatArabicDigits(minute)} ${period}`;
    }

    function getPeriodNumber(value) {
        const match = String(value ?? "").match(/\d+/);
        return match ? Number(match[0]) : 0;
    }

    function localDateString(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function parseLocalDate(value) {
        if (!value) return null;
        const parts = String(value).slice(0, 10).split("-").map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
        return new Date(parts[0], parts[1] - 1, parts[2], 12);
    }

    function getWeekDates() {
        const today = new Date();
        const sunday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            12
        );

        sunday.setDate(sunday.getDate() - sunday.getDay());

        return DAYS.map((day, index) => {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + index);

            return {
                ...day,
                date: localDateString(date)
            };
        });
    }

    function formatDate(value, includeDay = true) {
        const date = parseLocalDate(value);
        if (!date) return "";

        return new Intl.DateTimeFormat("ar-IQ", {
            weekday: includeDay ? "long" : undefined,
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(date);
    }

    function getAcademicYear() {
        const now = new Date();
        const year = now.getFullYear();

        return now.getMonth() >= 8
            ? `${year}-${year + 1}`
            : `${year - 1}-${year}`;
    }

    function safeImageUrl(value) {
        if (!value) return "";

        try {
            const url = new URL(String(value), window.location.origin);
            return ["https:", "http:"].includes(url.protocol) ? url.href : "";
        } catch {
            return "";
        }
    }

    function showError(container, message) {
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state error-state">
                <span class="empty-state-icon">!</span>
                <h3>تعذر تحميل البيانات</h3>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function showEmpty(container, title, message) {
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">✦</span>
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function getStudentDisplayName() {
        return state.profile?.full_name || "الطالب";
    }

    function getClassDisplayName() {
        const item = state.classItem;
        if (!item) return "غير محدد";

        return [
            item.stage || "",
            item.grade_name || item.name || "",
            item.gender || "",
            item.section_name ? `الشعبة ${item.section_name}` : ""
        ].filter(Boolean).join(" · ");
    }

    function getDayLessons(dayId) {
        return state.lessons
            .filter(lesson => lesson.day_of_week === dayId)
            .sort((a, b) => {
                const periodDifference =
                    getPeriodNumber(a.period) - getPeriodNumber(b.period);

                if (periodDifference !== 0) return periodDifference;

                return normalizeTime(a.start_time).localeCompare(
                    normalizeTime(b.start_time)
                );
            });
    }

    function getPostDate(post) {
        return String(post.target_date || post.created_at || "").slice(0, 10);
    }

    /* -------------------- WEEKLY DESIGN STYLES -------------------- */

   
function injectWeeklyStyles() {
    if ($("ilabratWeeklyDesignStyles")) return;

    const style = document.createElement("style");
    style.id = "ilabratWeeklyDesignStyles";

    style.textContent = `
        .weekly-table-wrapper {
            width: 100%;
            overflow-x: auto;
            overflow-y: visible;
            border: 1px solid #e7ded8;
            border-radius: 12px;
            background: #fff;
            direction: rtl;
        }

        .weekly-classic-table {
            width: 100%;
            min-width: 760px;
            border-collapse: collapse;
            table-layout: fixed;
            direction: rtl;
            background: #fff;
        }

        .weekly-classic-table th,
        .weekly-classic-table td {
            border: 1px solid #e5dcd6;
            padding: 13px 9px;
            text-align: center;
            vertical-align: middle;
        }

        .weekly-classic-table thead th {
            background: #5A1825;
            color: #fff;
            font-size: 14px;
            font-weight: 800;
            padding: 16px 8px;
        }

        .weekly-classic-table thead th:first-child {
            width: 105px;
            background: #43131D;
        }

        .weekly-classic-table tbody th {
            background: #F3EEE7;
            color: #5A1825;
            font-size: 13px;
            font-weight: 800;
            width: 105px;
        }

        .weekly-classic-table tbody td {
            min-height: 100px;
            background: #fff;
        }

        .weekly-classic-table .weekly-today-column {
            background: #F3EEE7 !important;
        }

        .weekly-classic-table thead th.weekly-today-column {
            background: #C7A56A !important;
            color: #43131D !important;
        }

        .weekly-classic-table tbody td.weekly-today-column {
            box-shadow: inset 0 0 0 1px rgba(199, 165, 106, .35);
        }

        .weekly-classic-table .weekly-day-date {
            display: block;
            margin-top: 5px;
            color: rgba(255,255,255,.8);
            font-size: 11px;
            font-weight: 400;
        }

        .weekly-classic-table th.weekly-today-column .weekly-day-date {
            color: #43131D;
        }

        .weekly-cell-lesson {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 85px;
            padding: 5px 2px;
        }

        .weekly-cell-subject {
            color: #5A1825;
            font-size: 15px;
            font-weight: 800;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        .weekly-cell-teacher {
            color: #75696c;
            font-size: 12px;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        .weekly-cell-time {
            color: #7A2A39;
            font-size: 11px;
            font-weight: 800;
            line-height: 1.5;
            direction: rtl;
        }

        .weekly-cell-empty {
            color: #c2b8b3;
            font-size: 18px;
        }

        .weekly-empty-state {
            padding: 25px;
            border: 1px solid #eee4e2;
            border-radius: 12px;
            background: #fff;
            color: #75696c;
            text-align: center;
        }

        .weekly-empty-state.error-state {
            color: #a12b38;
        }

        @media (max-width: 600px) {
            .weekly-classic-table {
                min-width: 700px;
            }

            .weekly-classic-table th,
            .weekly-classic-table td {
                padding: 10px 6px;
            }

            .weekly-classic-table thead th {
                font-size: 12px;
            }

            .weekly-cell-subject {
                font-size: 13px;
            }

            .weekly-cell-teacher {
                font-size: 11px;
            }

            .weekly-cell-time {
                font-size: 10px;
            }
        }
    `;

    document.head.appendChild(style);
}

    /* -------------------- LOAD STUDENT -------------------- */

    async function loadStudentData() {
        const { data: authData, error: authError } = await db.auth.getUser();

        if (authError) throw authError;

        state.user = authData?.user;

        if (!state.user) {
            window.location.replace("index.html");
            return false;
        }

        const { data: student, error: studentError } = await db
            .from("students")
            .select("id, profile_id, class_id")
            .eq("profile_id", state.user.id)
            .maybeSingle();

        if (studentError) throw studentError;

        if (!student?.class_id) {
            throw new Error(
                "هذا الحساب غير مرتبط بصف وشعبة. يرجى مراجعة إدارة المدرسة."
            );
        }

        state.student = student;

        const { data: classItem, error: classError } = await db
            .from("classes")
            .select("id, school_id, name, stage, grade_name, gender, section_name")
            .eq("id", student.class_id)
            .maybeSingle();

        if (classError) throw classError;
        if (!classItem) {
            throw new Error("تعذر العثور على الشعبة المرتبطة بحسابك.");
        }

        state.classItem = classItem;

        const profileResult = await db
            .from("profiles")
            .select("id, full_name")
            .eq("id", state.user.id)
            .maybeSingle();

        if (profileResult.error) {
            console.warn("Student profile query:", profileResult.error);
        }

        state.profile = profileResult.data || {};

        if (classItem.school_id) {
            const schoolResult = await db
                .from("schools")
                .select("id, name")
                .eq("id", classItem.school_id)
                .maybeSingle();

            if (schoolResult.error) {
                console.warn("School query:", schoolResult.error);
            }

            state.school = schoolResult.data || null;
        }

        return true;
    }

    /* -------------------- LOAD PUBLISHED TIMETABLE -------------------- */

    async function loadTimetable() {
        const expectedYear = getAcademicYear();
        state.academicYear = expectedYear;

        let { data, error } = await db
            .from("timetable_lessons")
            .select(`
                id, class_id, school_id, academic_year, day_of_week,
                period, subject, teacher_name, start_time, end_time,
                note, is_published
            `)
            .eq("school_id", state.classItem.school_id)
            .eq("class_id", state.classItem.id)
            .eq("academic_year", expectedYear)
            .eq("is_published", true)
            .order("period", { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            const fallback = await db
                .from("timetable_lessons")
                .select(`
                    id, class_id, school_id, academic_year, day_of_week,
                    period, subject, teacher_name, start_time, end_time,
                    note, is_published
                `)
                .eq("school_id", state.classItem.school_id)
                .eq("class_id", state.classItem.id)
                .eq("is_published", true)
                .order("period", { ascending: true });

            if (fallback.error) throw fallback.error;

            const available = fallback.data || [];

            if (available.length) {
                const years = [
                    ...new Set(
                        available
                            .map(item => item.academic_year)
                            .filter(Boolean)
                    )
                ].sort().reverse();

                if (years.length) {
                    state.academicYear = years[0];
                    data = available.filter(
                        item => item.academic_year === state.academicYear
                    );
                } else {
                    data = available;
                }
            } else {
                data = [];
            }
        }

        state.lessons = (data || []).filter(lesson =>
            DAYS.some(day => day.id === lesson.day_of_week)
        );

        if (elements.weeklyClassInfo) {
            elements.weeklyClassInfo.textContent =
                `${getClassDisplayName()} · السنة الدراسية ${state.academicYear}`;
        }
    }

    /* -------------------- LOAD POSTS FROM EDGE FUNCTION -------------------- */

    async function loadPosts() {
        state.postsError = "";

        const { data, error } = await db.functions.invoke("homework-handler", {
            body: { action: "student_posts" }
        });

        if (error) throw error;

        if (!data?.success) {
            throw new Error(
                data?.message ||
                "لم تتمكن الخدمة من تحميل واجبات وإعلانات الشعبة."
            );
        }

        state.posts = Array.isArray(data.posts) ? data.posts : [];

        const count = state.posts.filter(
            post => post.post_type === "school_announcement"
        ).length;

        if (elements.announcementCount) {
            elements.announcementCount.textContent = formatArabicDigits(count);
            elements.announcementCount.hidden = count === 0;
        }
    }

    /* -------------------- ACCOUNT -------------------- */

    function renderAccount() {
        if (!elements.accountContent) return;

        const info = [
            { label: "اسم الطالب", value: getStudentDisplayName(), icon: "♙" },
            { label: "اسم المدرسة", value: state.school?.name || "غير متاح", icon: "⌂" },
            { label: "المرحلة", value: state.classItem?.stage || "غير محددة", icon: "▤" },
            { label: "الصف", value: state.classItem?.grade_name || state.classItem?.name || "غير محدد", icon: "▦" },
            { label: "الشعبة", value: state.classItem?.section_name ? `الشعبة ${state.classItem.section_name}` : "غير محددة", icon: "▧" },
            { label: "الجنس", value: state.classItem?.gender || "غير محدد", icon: "♧" }
        ];

        elements.accountContent.innerHTML = info.map(item => `
            <article class="account-item">
                <span class="account-item-icon">${item.icon}</span>
                <div>
                    <span class="account-item-label">${escapeHTML(item.label)}</span>
                    <strong>${escapeHTML(item.value)}</strong>
                </div>
            </article>
        `).join("");

        if (elements.welcomeStudentName) {
            elements.welcomeStudentName.textContent = getStudentDisplayName();
        }

        if (elements.welcomeSchoolName) {
            elements.welcomeSchoolName.textContent =
                state.school?.name || "نتمنى لك يوماً دراسياً موفقاً";
        }
    }

    /* -------------------- HOMEWORK MATCHING -------------------- */

    function getHomeworkForLesson(lesson, date) {
        return state.posts.find(post =>
            post.post_type === "teacher_homework" &&
            String(post.subject || "").trim() ===
                String(lesson.subject || "").trim() &&
            getPostDate(post) === date
        ) || null;
    }

    function renderLesson(lesson, index, selectedDate) {
        const homework = getHomeworkForLesson(lesson, selectedDate);
        const subject = escapeHTML(lesson.subject || "مادة غير محددة");

        let homeworkStatus = "لا يوجد واجب لهذا اليوم";

        if (state.postsError) {
            homeworkStatus = "تعذر تحميل بيانات الواجب";
        } else if (homework) {
            homeworkStatus = "يوجد واجب لهذه المادة";
        }

        return `
            <article class="lesson-card daily-lesson-card">
                <div class="lesson-header">
                    <div class="lesson-number">
                        ${formatArabicDigits(index + 1)}
                    </div>
                    <div class="lesson-info">
                        <h3>${subject}</h3>
                    </div>
                </div>

                <div class="daily-homework-status ${
                    homework ? "has-homework" : "no-homework"
                }">
                    <span class="daily-homework-icon">
                        ${homework ? "✦" : "✓"}
                    </span>

                    <span>${homeworkStatus}</span>

                    ${homework ? `
                        <a class="homework-details-link"
                           href="homework-details.html?post_id=${encodeURIComponent(homework.id)}">
                            عرض الواجب
                            <span aria-hidden="true">←</span>
                        </a>
                    ` : ""}
                </div>
            </article>
        `;
    }

    /* -------------------- DAILY VIEW -------------------- */

    function updateDayNavigation() {
        const weekDates = getWeekDates();

        document.querySelectorAll(".day-tab").forEach(button => {
            const index = DAYS.findIndex(
                day => day.id === button.dataset.day
            );

            const dateInfo = weekDates[index];
            const active = index === state.currentDayIndex;

            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", String(active));

            const dateElement = button.querySelector("small");

            if (dateElement && dateInfo) {
                const date = parseLocalDate(dateInfo.date);

                dateElement.textContent = date
                    ? formatArabicDigits(date.getDate())
                    : "";
            }
        });

        if (elements.previousDay) {
            elements.previousDay.disabled = state.currentDayIndex === 0;
        }

        if (elements.nextDay) {
            elements.nextDay.disabled =
                state.currentDayIndex === DAYS.length - 1;
        }

        if (elements.dayPosition) {
            elements.dayPosition.textContent =
                `اليوم ${formatArabicDigits(state.currentDayIndex + 1)} من ${formatArabicDigits(5)}`;
        }
    }

    function renderDaily() {
        const day = DAYS[state.currentDayIndex];
        const dateInfo = getWeekDates()[state.currentDayIndex];

        if (!day || !dateInfo) return;

        const lessons = getDayLessons(day.id);

        if (elements.currentDayTitle) {
            elements.currentDayTitle.textContent = `جدولي يوم ${day.name}`;
        }

        if (elements.currentDate) {
            elements.currentDate.textContent = formatDate(dateInfo.date);
        }

        updateDayNavigation();

        if (!lessons.length) {
            showEmpty(
                elements.dayContent,
                "لا توجد حصص لهذا اليوم",
                "لا توجد حصص منشورة لشعبتك في هذا اليوم حالياً."
            );
        } else if (elements.dayContent) {
            elements.dayContent.innerHTML = lessons.map((lesson, index) =>
                renderLesson(lesson, index, dateInfo.date)
            ).join("");
        }

        const legacyPosts = $("dailyPostsSection");
        if (legacyPosts) legacyPosts.hidden = true;
    }

    /* -------------------- WEEKLY VIEW -------------------- */

   
function renderWeekly() {
    if (!elements.weeklyContainer) {
        console.error(
            "Weekly timetable container not found. Check .weekly-table-wrapper in HTML."
        );
        return;
    }

    injectWeeklyStyles();

    const weekDates = getWeekDates();
    const todayString = localDateString(new Date());

    // جمع الحصص وترتيب أرقامها وأوقاتها.
    const allLessons = [...state.lessons].sort((a, b) => {
        const periodDifference =
            getPeriodNumber(a.period) - getPeriodNumber(b.period);

        if (periodDifference !== 0) return periodDifference;

        return normalizeTime(a.start_time).localeCompare(
            normalizeTime(b.start_time)
        );
    });

    // استخراج أرقام الحصص دون تكرار.
    const periodsMap = new Map();

    allLessons.forEach((lesson, index) => {
        const periodKey = String(lesson.period ?? "").trim();

        if (!periodsMap.has(periodKey)) {
            periodsMap.set(periodKey, {
                key: periodKey,
                number: getPeriodNumber(lesson.period),
                startTime: normalizeTime(lesson.start_time),
                label: periodKey || `الحصة ${index + 1}`
            });
        }
    });

    const periods = [...periodsMap.values()].sort((a, b) => {
        if (a.number !== b.number) {
            return a.number - b.number;
        }

        return a.startTime.localeCompare(b.startTime);
    });

    // رأس الجدول: الأيام الخمسة.
    const headerHTML = `
        <thead>
            <tr>
                <th scope="col">الحصة</th>

                ${weekDates.map(day => {
                    const isToday = day.date === todayString;

                    return `
                        <th
                            scope="col"
                            class="${isToday ? "weekly-today-column" : ""}"
                            aria-current="${isToday ? "date" : "false"}">

                            ${escapeHTML(day.name)}

                            <span class="weekly-day-date">
                                ${escapeHTML(formatDate(day.date, false))}
                            </span>
                        </th>
                    `;
                }).join("")}
            </tr>
        </thead>
    `;

    // صف لكل حصة، وعمود لكل يوم.
    let bodyHTML = "";

    if (!periods.length) {
        bodyHTML = `
            <tbody>
                <tr>
                    <td colspan="6">
                        <div class="weekly-empty-state">
                            لا توجد حصص منشورة في الجدول الأسبوعي حالياً.
                        </div>
                    </td>
                </tr>
            </tbody>
        `;
    } else {
        bodyHTML = `
            <tbody>
                ${periods.map((period, periodIndex) => `
                    <tr>
                        <th scope="row">
                            ${escapeHTML(
                                period.number
                                    ? `الحصة ${formatArabicDigits(period.number)}`
                                    : period.label
                            )}
                        </th>

                        ${weekDates.map(day => {
                            const isToday = day.date === todayString;

                            const lesson = getDayLessons(day.id).find(item => {
                                const itemPeriod = String(
                                    item.period ?? ""
                                ).trim();

                                if (period.number) {
                                    return getPeriodNumber(item.period) ===
                                        period.number;
                                }

                                return itemPeriod === period.key;
                            });

                            if (!lesson) {
                                return `
                                    <td class="${isToday ? "weekly-today-column" : ""}">
                                        <span class="weekly-cell-empty">—</span>
                                    </td>
                                `;
                            }

                            return `
                                <td class="${isToday ? "weekly-today-column" : ""}">
                                    <div class="weekly-cell-lesson">

                                        <strong class="weekly-cell-subject">
                                            ${escapeHTML(
                                                lesson.subject || "مادة غير محددة"
                                            )}
                                        </strong>

                                        <span class="weekly-cell-teacher">
                                            المعلم:
                                            ${escapeHTML(
                                                lesson.teacher_name || "غير محدد"
                                            )}
                                        </span>

                                        <span class="weekly-cell-time">
                                            ${escapeHTML(formatTime(lesson.start_time))}
                                            -
                                            ${escapeHTML(formatTime(lesson.end_time))}
                                        </span>

                                    </div>
                                </td>
                            `;
                        }).join("")}
                    </tr>
                `).join("")}
            </tbody>
        `;
    }

    elements.weeklyContainer.innerHTML = `
        <table class="weekly-classic-table">
            ${headerHTML}
            ${bodyHTML}
        </table>
    `;
}

    /* -------------------- SCHOOL ANNOUNCEMENTS -------------------- */

    function getPostAttachments(post) {
        const attachments = Array.isArray(post.attachments)
            ? post.attachments
            : [];

        const result = [];

        attachments.forEach(item => {
            const url = safeImageUrl(item.url);

            if (url) {
                result.push({
                    url,
                    name: item.file_name || "مرفق من المدرسة"
                });
            }
        });

        const legacyImage = safeImageUrl(post.image_url);

        if (
            legacyImage &&
            !result.some(item => item.url === legacyImage)
        ) {
            result.push({
                url: legacyImage,
                name: "مرفق من المدرسة"
            });
        }

        return result;
    }

    function renderAnnouncementAttachments(post) {
        const attachments = getPostAttachments(post);

        if (!attachments.length) return "";

        return `
            <div class="homework-attachments">
                ${attachments.map((item, index) => `
                    <button
                        type="button"
                        class="homework-image-button post-image-button"
                        data-image-url="${escapeHTML(item.url)}"
                        data-image-caption="${escapeHTML(item.name)}"
                        aria-label="عرض المرفق ${formatArabicDigits(index + 1)}">

                        <img
                            src="${escapeHTML(item.url)}"
                            alt="${escapeHTML(item.name)}"
                            loading="lazy">

                        <span class="image-open-hint">عرض المرفق</span>
                    </button>
                `).join("")}
            </div>
        `;
    }

    function renderAnnouncement(post) {
        const date = post.target_date
            ? formatDate(post.target_date)
            : formatDate(post.created_at);

        return `
            <article class="post-card">
                <div class="post-card-header">
                    <span class="post-type-icon">✦</span>

                    <div>
                        <strong>إعلان المدرسة</strong>
                        <small>
                            ${escapeHTML(date || "تاريخ النشر غير متاح")}
                        </small>
                    </div>
                </div>

                ${post.content
                    ? `<div class="post-content">${escapeHTML(post.content)}</div>`
                    : ""}

                ${renderAnnouncementAttachments(post)}
            </article>
        `;
    }

    function renderAnnouncements() {
        if (!elements.announcementsContent) return;

        if (state.postsError) {
            showError(elements.announcementsContent, state.postsError);
            return;
        }

        const announcements = state.posts.filter(
            post => post.post_type === "school_announcement"
        );

        if (!announcements.length) {
            showEmpty(
                elements.announcementsContent,
                "لا توجد إعلانات حالياً",
                "ستظهر هنا إعلانات المدرسة عند نشرها."
            );

            return;
        }

        elements.announcementsContent.innerHTML =
            announcements.map(renderAnnouncement).join("");
    }

    /* -------------------- NAVIGATION -------------------- */

    function switchView(viewName) {
        const views = {
            account: $("accountView"),
            daily: $("dailyView"),
            weekly: $("weeklyView"),
            announcements: $("announcementsView")
        };

        if (!views[viewName]) return;

        state.currentView = viewName;

        Object.entries(views).forEach(([name, panel]) => {
            if (panel) panel.hidden = name !== viewName;
        });

        document.querySelectorAll(".student-tab").forEach(button => {
            const active = button.dataset.view === viewName;

            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", String(active));
        });

        if (viewName === "daily") renderDaily();
        if (viewName === "weekly") renderWeekly();
        if (viewName === "announcements") renderAnnouncements();
        if (viewName === "account") renderAccount();
    }

    /* -------------------- IMAGE VIEWER -------------------- */

    function openImageViewer(url, caption) {
        const safeUrl = safeImageUrl(url);

        if (!safeUrl || !elements.imageViewer) return;

        if (elements.viewerImage) {
            elements.viewerImage.src = safeUrl;
        }

        if (elements.viewerCaption) {
            elements.viewerCaption.textContent =
                caption || "مرفق من المدرسة";
        }

        if (!elements.imageViewer.open) {
            elements.imageViewer.showModal();
        }
    }

    function closeImageViewer() {
        if (elements.imageViewer?.open) {
            elements.imageViewer.close();
        }
    }

    /* -------------------- LOGOUT -------------------- */

    function bindLogout() {
        if (!elements.logoutButton) return;

        elements.logoutButton.addEventListener("click", async () => {
            if (!window.confirm("هل تريد تسجيل الخروج من النظام؟")) return;

            elements.logoutButton.disabled = true;

            elements.logoutButton.innerHTML =
                "<span>↪</span><span>جارٍ تسجيل الخروج...</span>";

            try {
                const { error } = await db.auth.signOut();

                if (error) throw error;

                window.location.replace("index.html");
            } catch (error) {
                console.error("Logout error:", error);

                window.alert(
                    "تعذر تسجيل الخروج. تحقق من الاتصال ثم حاول مرة أخرى."
                );

                elements.logoutButton.disabled = false;

                elements.logoutButton.innerHTML =
                    "<span>↪</span><span>تسجيل الخروج</span>";
            }
        });
    }

    /* -------------------- EVENTS -------------------- */

    function bindEvents() {
        document.querySelectorAll(".student-tab").forEach(button => {
            button.addEventListener("click", () =>
                switchView(button.dataset.view)
            );
        });

        document.querySelectorAll(".day-tab").forEach(button => {
            button.addEventListener("click", () => {
                const index = DAYS.findIndex(
                    day => day.id === button.dataset.day
                );

                if (index < 0) return;

                state.currentDayIndex = index;
                renderDaily();
            });
        });

        elements.previousDay?.addEventListener("click", () => {
            if (state.currentDayIndex > 0) {
                state.currentDayIndex--;
                renderDaily();
            }
        });

        elements.nextDay?.addEventListener("click", () => {
            if (state.currentDayIndex < DAYS.length - 1) {
                state.currentDayIndex++;
                renderDaily();
            }
        });

        document.addEventListener("click", event => {
            const imageButton = event.target.closest("[data-image-url]");

            if (imageButton) {
                openImageViewer(
                    imageButton.dataset.imageUrl,
                    imageButton.dataset.imageCaption
                );
            }
        });

        $("closeImageViewer")?.addEventListener(
            "click",
            closeImageViewer
        );

        elements.imageViewer?.addEventListener("click", event => {
            if (event.target === elements.imageViewer) {
                closeImageViewer();
            }
        });

        elements.imageViewer?.addEventListener("close", () => {
            elements.viewerImage?.removeAttribute("src");

            if (elements.viewerCaption) {
                elements.viewerCaption.textContent = "";
            }
        });

        bindLogout();
    }

    /* -------------------- INITIALIZATION -------------------- */

    async function initialize() {
        const yearElement = $("currentYear");

        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }

        if (!db?.auth || !db?.from || !db?.functions) {
            showError(
                elements.dayContent,
                "تعذر الاتصال بقاعدة البيانات. تحقق من إعدادات Supabase."
            );

            return;
        }

        const today = new Date().getDay();

        state.currentDayIndex =
            today >= 0 && today <= 4 ? today : 0;

        bindEvents();

        try {
            const loaded = await loadStudentData();

            if (!loaded) return;

            await loadTimetable();

            renderAccount();
            renderDaily();
            renderWeekly();

            try {
                await loadPosts();
            } catch (postError) {
                console.error("Posts loading error:", postError);

                state.posts = [];

                state.postsError =
                    postError?.message ||
                    "تعذر تحميل الواجبات والإعلانات. حاول تحديث الصفحة.";

                if (elements.announcementCount) {
                    elements.announcementCount.hidden = true;
                }
            }

            // إعادة رسم اليوم بعد تحميل الواجبات.
            renderDaily();
            renderAnnouncements();

            switchView("daily");

        } catch (error) {
            console.error(
                "Student portal initialization error:",
                error
            );

            const message =
                error?.message ||
                "حدث خطأ أثناء تحميل بيانات الطالب.";

            showError(elements.dayContent, message);
            showError(elements.accountContent, message);
            showWeeklyError(message);
        }
    }

    function showWeeklyError(message) {
        if (elements.weeklyContainer) {
            elements.weeklyContainer.innerHTML = `
                <div class="weekly-empty-state error-state">
                    ${escapeHTML(message)}
                </div>
            `;
        }
    }

    initialize();
})();
