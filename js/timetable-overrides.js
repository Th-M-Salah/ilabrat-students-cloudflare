
"use strict";

/*
 * ILABRAT Students
 * Temporary timetable overrides.
 *
 * This file manages date-specific changes separately from the
 * weekly timetable. It must never save overrides through saveSchedule().
 */

(() => {
    const $override = (id) => document.getElementById(id);

    const state = {
        enabled: false,
        selectedDate: "",
        activeLesson: null,
        overrides: new Map(),
        loading: false,
        saving: false,
        originalRenderSchedule: null,
        originalLoadSchedule: null
    };

    const DAYS_OVERRIDE = [
        { id: "sun", name: "الأحد", index: 0 },
        { id: "mon", name: "الاثنين", index: 1 },
        { id: "tue", name: "الثلاثاء", index: 2 },
        { id: "wed", name: "الأربعاء", index: 3 },
        { id: "thu", name: "الخميس", index: 4 }
    ];

    function localDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function parseLocalDate(value) {
        if (!value) return null;

        const parts = value.split("-").map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

        return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    }

    function getSunday(date) {
        const result = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            12,
            0,
            0,
            0
        );

        result.setDate(result.getDate() - result.getDay());
        return result;
    }

    function getWeekDates() {
        const selected = parseLocalDate(state.selectedDate) || new Date();
        const sunday = getSunday(selected);

        return DAYS_OVERRIDE.map((day) => {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + day.index);

            return {
                ...day,
                date: localDateString(date)
            };
        });
    }

    function selectedDayDate(dayId) {
        return getWeekDates().find((day) => day.id === dayId)?.date || "";
    }

    function overrideKey(lessonId, date) {
        return `${String(lessonId)}|${date}`;
    }

    function getCurrentLessons() {
        return Array.isArray(lessons) ? lessons : [];
    }

    function isPersistedLesson(lesson) {
        if (!lesson || lesson.id === undefined || lesson.id === null) {
            return false;
        }

        return /^\d+$/.test(String(lesson.id));
    }

    function getLessonById(id) {
        return getCurrentLessons().find(
            (lesson) => String(lesson.id) === String(id)
        ) || null;
    }

    function getCurrentOverride(lessonId, date) {
        return state.overrides.get(overrideKey(lessonId, date)) || null;
    }

    function showMessage(message, isError = false) {
        if (typeof showToast === "function") {
            showToast(message, isError);
            return;
        }

        const toast = $override("toastMessage");
        if (!toast) {
            if (isError) console.error(message);
            else console.log(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");
        window.setTimeout(() => toast.classList.remove("show"), 3500);
    }

    function setOverrideMode(enabled) {
        state.enabled = enabled;

        const baseButton = $override("baseTimetableMode");
        const temporaryButton = $override("temporaryTimetableMode");
        const hint = $override("overrideModeHint");
        const addLessonButton = $override("addLessonButton");
        const saveButton = $override("saveScheduleButton");
        const publishButton = $override("publishBottomButton");
        const topPublishButton = $override("publishScheduleButton");

        baseButton?.classList.toggle("active", !enabled);
        temporaryButton?.classList.toggle("active", enabled);

        baseButton?.setAttribute("aria-pressed", String(!enabled));
        temporaryButton?.setAttribute("aria-pressed", String(enabled));

        if (hint) {
            hint.textContent = enabled
                ? "وضع التعديل المؤقت: أي تغيير تحفظه سيخص التاريخ المحدد فقط، ولن يغيّر الجدول الأسبوعي الأساسي."
                : "أنت تعرض الجدول الأسبوعي الأساسي. التغييرات هنا تخص الجدول الأسبوعي نفسه.";
        }

        if (addLessonButton) {
            addLessonButton.disabled = enabled;
            addLessonButton.title = enabled
                ? "أضف الحصص الجديدة من وضع الجدول الأساسي."
                : "";
        }

        // Keep base-table save and publish actions unavailable in temporary mode.
        [saveButton, publishButton, topPublishButton].forEach((button) => {
            if (!button) return;
            button.disabled = enabled;
            button.title = enabled
                ? "الحفظ والنشر يخصان الجدول الأساسي. احفظ التعديل المؤقت من نافذته."
                : "";
        });

        renderWithOverrides();
    }

    function getDisplayDate(dateString) {
        const date = parseLocalDate(dateString);
        if (!date) return dateString || "";

        return new Intl.DateTimeFormat("ar-IQ", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(date);
    }

    function updateWeekDateLabels() {
        const weekDates = getWeekDates();

        document.querySelectorAll("#weeklySchedule .day-column").forEach((column) => {
            const dayId = column.dataset.day;
            const info = weekDates.find((day) => day.id === dayId);
            if (!info) return;

            let dateLabel = column.querySelector(".override-day-date");

            if (!dateLabel) {
                dateLabel = document.createElement("div");
                dateLabel.className = "override-day-date";

                const heading = column.querySelector(".day-header, .day-title, h3, h2");
                if (heading) {
                    heading.insertAdjacentElement("afterend", dateLabel);
                } else {
                    column.insertBefore(dateLabel, column.firstChild);
                }
            }

            dateLabel.textContent = info.date;
            dateLabel.setAttribute("title", getDisplayDate(info.date));
        });
    }

    function decorateLessonCards() {
        const dateByDay = new Map(
            getWeekDates().map((day) => [day.id, day.date])
        );

        document.querySelectorAll("#weeklySchedule [data-edit-id]").forEach((card) => {
            card.classList.remove("has-temporary-override", "temporarily-cancelled");

            const oldPreview = card.querySelector(".temporary-override-preview");
            if (oldPreview) oldPreview.remove();

            const lessonId = card.dataset.editId;
            const lesson = getLessonById(lessonId);
            if (!lesson) return;

            const date = dateByDay.get(lesson.day);
            if (!date) return;

            const override = getCurrentOverride(lesson.id, date);
            if (!override) return;

            card.classList.add("has-temporary-override");

            const preview = document.createElement("span");
            preview.className = "temporary-override-preview";

            if (override.is_cancelled) {
                card.classList.add("temporarily-cancelled");
                preview.textContent = "ملغاة لهذا اليوم";
            } else {
                const subject = override.subject || lesson.subject || "الحصة";
                const start = (override.start_time || lesson.start_time || "").slice(0, 5);
                const end = (override.end_time || lesson.end_time || "").slice(0, 5);

                preview.textContent = `تعديل مؤقت: ${subject}${start ? ` · ${start}` : ""}${end ? `–${end}` : ""}`;
            }

            card.appendChild(preview);
            card.setAttribute(
                "title",
                override.is_cancelled
                    ? `الحصة ملغاة بتاريخ ${date}`
                    : `يوجد تعديل مؤقت بتاريخ ${date}`
            );
        });
    }

    function renderWithOverrides() {
        if (typeof state.originalRenderSchedule === "function") {
            state.originalRenderSchedule();
        }

        updateWeekDateLabels();
        decorateLessonCards();
        updateModeHintDate();
    }

    function updateModeHintDate() {
        const hint = $override("overrideModeHint");
        if (!hint) return;

        const selected = state.selectedDate;
        if (!selected) return;

        const dateText = getDisplayDate(selected);

        hint.textContent = state.enabled
            ? `وضع التعديل المؤقت للتاريخ: ${dateText}. اختر حصة موجودة لتعديلها أو إلغائها لهذا اليوم فقط.`
            : `الجدول الأساسي معروض للأسبوع الذي يتضمن ${dateText}.`;
    }

    async function loadOverrides() {
        if (!db || !selectedClassId || !currentSchool || !currentSchool.id) {
            state.overrides.clear();
            renderWithOverrides();
            return;
        }

        const persistedIds = getCurrentLessons()
            .filter(isPersistedLesson)
            .map((lesson) => Number(lesson.id));

        if (persistedIds.length === 0) {
            state.overrides.clear();
            renderWithOverrides();
            return;
        }

        const weekDates = getWeekDates();
        const startDate = weekDates[0].date;
        const endDate = weekDates[weekDates.length - 1].date;

        state.loading = true;

        try {
            const { data, error } = await db
                .from("timetable_lesson_overrides")
                .select(
                    "id, lesson_id, lesson_date, subject, teacher_name, start_time, end_time, note, is_cancelled, created_by, created_at, updated_at"
                )
                .in("lesson_id", persistedIds)
                .gte("lesson_date", startDate)
                .lte("lesson_date", endDate);

            if (error) throw error;

            state.overrides.clear();

            (data || []).forEach((row) => {
                state.overrides.set(
                    overrideKey(row.lesson_id, row.lesson_date),
                    row
                );
            });

            renderWithOverrides();
        } catch (error) {
            console.error("Failed to load timetable overrides:", error);
            showMessage(
                "تعذر تحميل التعديلات المؤقتة. تحقق من صلاحيات الجدول وسياسات RLS.",
                true
            );
        } finally {
            state.loading = false;
        }
    }

    function setOverrideFormDisabled(disabled) {
        const form = $override("temporaryOverrideForm");
        if (!form) return;

        form.querySelectorAll("input, button").forEach((element) => {
            if (element.id === "closeOverrideModal" ||
                element.id === "cancelOverrideModal") {
                return;
            }

            element.disabled = disabled;
        });

        const saveButton = $override("saveOverrideButton");
        if (saveButton) {
            saveButton.textContent = disabled
                ? "جارٍ الحفظ..."
                : "حفظ لهذا التاريخ فقط";
        }
    }

    function updateCancelledFields() {
        const cancelled = Boolean($override("overrideCancelled")?.checked);
        const fields = $override("overrideFields");

        if (fields) {
            fields.querySelectorAll("input").forEach((input) => {
                input.disabled = cancelled;
                input.required = !cancelled && input.id !== "overrideNote";
            });
        }
    }

    function openOverrideModal(lesson) {
        if (!lesson) return;

        if (!isPersistedLesson(lesson)) {
            showMessage(
                "احفظ الحصة الأساسية أولًا، ثم يمكنك إضافة تعديل مؤقت لها.",
                true
            );
            return;
        }

        const date = selectedDayDate(lesson.day);
        if (!date) {
            showMessage("تعذر تحديد تاريخ الحصة.", true);
            return;
        }

        state.activeLesson = lesson;

        const existing = getCurrentOverride(lesson.id, date);

        $override("overrideModalTitle").textContent =
            existing ? "تعديل التغيير المؤقت" : "تعديل الحصة";

        $override("overrideModalDate").textContent = getDisplayDate(date);

        $override("overrideSubject").value =
            existing?.subject ?? lesson.subject ?? "";

        $override("overrideTeacher").value =
            existing?.teacher_name ?? lesson.teacher_name ?? lesson.teacher ?? "";

        $override("overrideStart").value =
            (existing?.start_time ?? lesson.start_time ?? "08:00").slice(0, 5);

        $override("overrideEnd").value =
            (existing?.end_time ?? lesson.end_time ?? "08:45").slice(0, 5);

        $override("overrideNote").value =
            existing?.note ?? lesson.note ?? "";

        $override("overrideCancelled").checked =
            Boolean(existing?.is_cancelled);

        $override("overrideFormError").textContent = "";

        const removeButton = $override("removeOverrideButton");
        if (removeButton) {
            removeButton.hidden = !existing;
        }

        updateCancelledFields();

        const modal = $override("temporaryOverrideModal");
        if (modal) {
            modal.hidden = false;
            modal.classList.add("is-open");
            document.body.classList.add("modal-open");
        }
    }

    function closeOverrideModal() {
        const modal = $override("temporaryOverrideModal");
        if (modal) {
            modal.hidden = true;
            modal.classList.remove("is-open");
        }

        document.body.classList.remove("modal-open");
        state.activeLesson = null;
        state.saving = false;
        setOverrideFormDisabled(false);
    }

    function validateOverrideForm() {
        const cancelled = Boolean($override("overrideCancelled").checked);
        if (cancelled) return "";

        const subject = $override("overrideSubject").value.trim();
        const teacher = $override("overrideTeacher").value.trim();
        const start = $override("overrideStart").value;
        const end = $override("overrideEnd").value;

        if (!subject) return "اكتب اسم المادة.";
        if (!teacher) return "اكتب اسم المدرس.";
        if (!start || !end) return "حدد وقت البداية والنهاية.";
        if (start >= end) return "وقت النهاية يجب أن يكون بعد وقت البداية.";

        return "";
    }

    async function saveOverride(event) {
        event.preventDefault();

        if (state.saving) return;

        const lesson = state.activeLesson;
        if (!lesson || !currentUser?.id) {
            $override("overrideFormError").textContent =
                "تعذر التحقق من حساب المستخدم. أعد تسجيل الدخول.";
            return;
        }

        if (!isPersistedLesson(lesson)) {
            $override("overrideFormError").textContent =
                "يجب حفظ الحصة الأساسية أولًا.";
            return;
        }

        const validationError = validateOverrideForm();
        if (validationError) {
            $override("overrideFormError").textContent = validationError;
            return;
        }

        const date = selectedDayDate(lesson.day);
        const cancelled = Boolean($override("overrideCancelled").checked);

        const payload = {
            lesson_id: Number(lesson.id),
            lesson_date: date,
            subject: cancelled
                ? (lesson.subject || "")
                : $override("overrideSubject").value.trim(),
            teacher_name: cancelled
                ? (lesson.teacher_name || lesson.teacher || "")
                : $override("overrideTeacher").value.trim(),
            start_time: cancelled
                ? (lesson.start_time || "08:00")
                : $override("overrideStart").value,
            end_time: cancelled
                ? (lesson.end_time || "08:45")
                : $override("overrideEnd").value,
            note: $override("overrideNote").value.trim(),
            is_cancelled: cancelled,
            created_by: currentUser.id,
            updated_at: new Date().toISOString()
        };

        state.saving = true;
        setOverrideFormDisabled(true);
        $override("overrideFormError").textContent = "";

        try {
            const { data, error } = await db
                .from("timetable_lesson_overrides")
                .upsert(payload, {
                    onConflict: "lesson_id,lesson_date"
                })
                .select(
                    "id, lesson_id, lesson_date, subject, teacher_name, start_time, end_time, note, is_cancelled, created_by, created_at, updated_at"
                )
                .single();

            if (error) throw error;

            state.overrides.set(overrideKey(lesson.id, date), data);
            closeOverrideModal();
            renderWithOverrides();

            showMessage(
                cancelled
                    ? "تم إلغاء الحصة لهذا التاريخ فقط."
                    : "تم حفظ التعديل المؤقت لهذا التاريخ فقط."
            );
        } catch (error) {
            console.error("Failed to save timetable override:", error);

            $override("overrideFormError").textContent =
                error?.message ||
                "تعذر الحفظ. تحقق من بنية الجدول وسياسات RLS.";

            state.saving = false;
            setOverrideFormDisabled(false);
        }
    }

    async function removeOverride() {
        const lesson = state.activeLesson;
        if (!lesson) return;

        const date = selectedDayDate(lesson.day);
        const existing = getCurrentOverride(lesson.id, date);

        if (!existing) {
            closeOverrideModal();
            return;
        }

        if (!window.confirm(
            `هل تريد إزالة التعديل المؤقت ليوم ${getDisplayDate(date)}؟ ستعود الحصة إلى تفاصيلها الأساسية.`
        )) {
            return;
        }

        const button = $override("removeOverrideButton");
        if (button) button.disabled = true;

        try {
            const { error } = await db
                .from("timetable_lesson_overrides")
                .delete()
                .eq("lesson_id", Number(lesson.id))
                .eq("lesson_date", date);

            if (error) throw error;

            state.overrides.delete(overrideKey(lesson.id, date));
            closeOverrideModal();
            renderWithOverrides();
            showMessage("تمت إزالة التعديل المؤقت وعادت الحصة إلى جدولها الأساسي.");
        } catch (error) {
            console.error("Failed to remove timetable override:", error);

            $override("overrideFormError").textContent =
                error?.message || "تعذر إزالة التعديل المؤقت.";

            if (button) button.disabled = false;
        }
    }

    function changeSelectedDate(date) {
        const parsed = parseLocalDate(date);
        if (!parsed) return;

        state.selectedDate = localDateString(parsed);

        const input = $override("overrideWeekDate");
        if (input) input.value = state.selectedDate;

        renderWithOverrides();
        void loadOverrides();
    }

    function shiftWeek(amount) {
        const current = parseLocalDate(state.selectedDate) || new Date();
        current.setDate(current.getDate() + amount * 7);
        changeSelectedDate(localDateString(current));
    }

    function bindControls() {
        $override("baseTimetableMode")?.addEventListener("click", () => {
            setOverrideMode(false);
        });

        $override("temporaryTimetableMode")?.addEventListener("click", () => {
            setOverrideMode(true);
        });

        $override("previousOverrideWeek")?.addEventListener("click", () => {
            shiftWeek(-1);
        });

        $override("nextOverrideWeek")?.addEventListener("click", () => {
            shiftWeek(1);
        });

        $override("overrideWeekDate")?.addEventListener("change", (event) => {
            changeSelectedDate(event.target.value);
        });

        $override("temporaryOverrideForm")?.addEventListener("submit", saveOverride);

        $override("overrideCancelled")?.addEventListener("change", updateCancelledFields);

        $override("closeOverrideModal")?.addEventListener("click", closeOverrideModal);
        $override("cancelOverrideModal")?.addEventListener("click", closeOverrideModal);
        $override("removeOverrideButton")?.addEventListener("click", removeOverride);

        $override("temporaryOverrideModal")?.addEventListener("click", (event) => {
            if (event.target === $override("temporaryOverrideModal")) {
                closeOverrideModal();
            }
        });

        // Capture the click before the base timetable's own edit handler.
        $override("weeklySchedule")?.addEventListener("click", (event) => {
            if (!state.enabled) return;

            const card = event.target.closest("[data-edit-id]");
            if (card) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                const lesson = getLessonById(card.dataset.editId);
                if (lesson) openOverrideModal(lesson);
                return;
            }

            if (event.target.closest("[data-add-day]")) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                showMessage(
                    "في وضع التعديل المؤقت يمكنك تعديل حصة موجودة فقط. لإضافة حصة جديدة انتقل إلى الجدول الأساسي."
                );
            }
        }, true);
    }

    function installWrappers() {
        if (typeof renderSchedule === "function") {
            state.originalRenderSchedule = renderSchedule;

            renderSchedule = function (...args) {
                const result = state.originalRenderSchedule.apply(this, args);
                updateWeekDateLabels();
                decorateLessonCards();
                updateModeHintDate();
                return result;
            };
        }

        if (typeof loadSchedule === "function") {
            state.originalLoadSchedule = loadSchedule;

            loadSchedule = async function (...args) {
                const result = await state.originalLoadSchedule.apply(this, args);
                await loadOverrides();
                return result;
            };
        }
    }

    function initializeOverrides() {
        const dateInput = $override("overrideWeekDate");
        const today = new Date();

        state.selectedDate = localDateString(today);

        if (dateInput) {
            dateInput.value = state.selectedDate;
        }

        installWrappers();
        bindControls();
        setOverrideMode(false);

        // If the base timetable has already loaded, load the matching overrides.
        if (getCurrentLessons().length > 0) {
            void loadOverrides();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeOverrides, {
            once: true
        });
    } else {
        initializeOverrides();
    }
})();
