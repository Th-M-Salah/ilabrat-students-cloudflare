
"use strict";

/* ILABRAT - Main Admin Dashboard */

const dashboardData = {
    schools: [],
    managers: []
};

const $ = (id) => document.getElementById(id);

let supabaseClientInstance = null;
let currentUser = null;
let toastTimer = null;
let schoolPendingDelete = null;

document.addEventListener("DOMContentLoaded", initializeDashboard);

/* =========================
   INITIALIZATION
========================= */

async function initializeDashboard() {
    bindNavigationEvents();
    bindSchoolEvents();
    bindManagerEvents();
    bindGeneralEvents();
    bindSchoolManagementEvents();

    supabaseClientInstance = getSupabaseClient();

    if (!supabaseClientInstance) {
        showToast("تعذر الاتصال بـ Supabase. تحقق من ملف الإعدادات.", "error");
        return;
    }

    if (!await verifyMainAdmin()) return;

    await loadSchools();
    await loadManagers();
    renderDashboard();
}

function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
        return supabaseClient;
    }

    return null;
}

/* =========================
   AUTHENTICATION
========================= */

async function verifyMainAdmin() {
    try {
        const {
            data: { user },
            error: authError
        } = await supabaseClientInstance.auth.getUser();

        if (authError || !user) {
            redirectToLogin();
            return false;
        }

        currentUser = user;

        const { data: profile, error } = await supabaseClientInstance
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;

        if (!profile || profile.role !== "admin") {
            showToast(
                "ليس لديك صلاحية الدخول إلى لوحة مدير التطبيق.",
                "error"
            );

            await supabaseClientInstance.auth.signOut();
            redirectToLogin();
            return false;
        }

        if ($("adminName")) {
            $("adminName").textContent =
                profile.full_name || user.email || "مدير التطبيق";
        }

        return true;
    } catch (error) {
        console.error("Authentication error:", error);

        showToast(
            getErrorMessage(error, "تعذر التحقق من صلاحيات الحساب."),
            "error"
        );

        return false;
    }
}

function redirectToLogin() {
    window.location.replace("index.html");
}

/* =========================
   SCHOOLS: LOAD AND DISPLAY
========================= */

async function loadSchools() {
    try {
        const { data, error } = await supabaseClientInstance
            .from("schools")
            .select("id, name, created_at, location, is_active")
            .order("created_at", { ascending: false });

        if (error) throw error;

        dashboardData.schools = (data || []).map((school) => ({
            ...school,
            is_active: school.is_active !== false,
            manager_name: "",
            manager_phone: "",
            manager_profile_id: null
        }));

        renderSchools();
        updateSchoolSelect();
        updateStatistics();
    } catch (error) {
        console.error("Load schools error:", error);

        showToast(
            getErrorMessage(error, "تعذر تحميل المدارس."),
            "error"
        );
    }
}

function renderSchools() {
    const primaryTable = $("schoolsTableBody");
    const secondaryTable = $("schoolsSecondaryTableBody");

    // بحث مستقل لجدول المدارس المسجلة في الرئيسية
    const primarySearchTerm = ($("schoolSearch")?.value || "")
        .trim()
        .toLocaleLowerCase("ar");

    // بحث مستقل لجدول إدارة المدارس
    const secondarySearchTerm = ($("schoolSearchSecondary")?.value || "")
        .trim()
        .toLocaleLowerCase("ar");

    function matchesSearch(school, searchTerm) {
        const name = String(school.name || "").toLocaleLowerCase("ar");
        const location = String(school.location || "").toLocaleLowerCase("ar");
        const manager = String(school.manager_name || "")
            .toLocaleLowerCase("ar");
        const phone = String(school.manager_phone || "")
            .toLocaleLowerCase("ar");

        return (
            name.includes(searchTerm) ||
            location.includes(searchTerm) ||
            manager.includes(searchTerm) ||
            phone.includes(searchTerm)
        );
    }

    const primarySchools = dashboardData.schools.filter((school) =>
        matchesSearch(school, primarySearchTerm)
    );

    const secondarySchools = dashboardData.schools.filter((school) =>
        matchesSearch(school, secondarySearchTerm)
    );

    // جدول المدارس المسجلة: ستة أعمدة
    if (primaryTable) {
        primaryTable.replaceChildren();

        if (primarySchools.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 6;
            cell.textContent = "لا توجد مدارس مطابقة.";

            row.appendChild(cell);
            primaryTable.appendChild(row);
        } else {
            primarySchools.forEach((school) => {
                primaryTable.appendChild(createSchoolRow(school));
            });
        }
    }

    // جدول إدارة المدارس: أربعة أعمدة
    if (secondaryTable) {
        secondaryTable.replaceChildren();

        if (secondarySchools.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.textContent = "لا توجد مدارس مطابقة.";

            row.appendChild(cell);
            secondaryTable.appendChild(row);
        } else {
            secondarySchools.forEach((school) => {
                secondaryTable.appendChild(
                    createSecondarySchoolRow(school)
                );
            });
        }
    }

    if ($("resultsCount")) {
        $("resultsCount").textContent =
            `${primarySchools.length} مدرسة`;
    }

    if ($("resultsCountSecondary")) {
        $("resultsCountSecondary").textContent =
            `${secondarySchools.length} مدرسة`;
    }

    setElementVisible(
        $("emptyState"),
        primarySchools.length === 0
    );

    setElementVisible(
        $("schoolsManagementEmptyState"),
        secondarySchools.length === 0
    );

    updateStatistics();
}

/* =========================
   SCHOOL TABLE ROWS
========================= */

function createSchoolRow(school) {
    const row = document.createElement("tr");

    // 1. اسم المدرسة
    const nameCell = document.createElement("td");

    const name = document.createElement("div");
    name.textContent = school.name || "مدرسة بدون اسم";
    name.style.fontWeight = "600";

    nameCell.appendChild(name);

    // 2. تاريخ الإضافة
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(school.created_at);

    // 3. حالة المدرسة
    const statusCell = document.createElement("td");

    const status = document.createElement("span");
    status.textContent = school.is_active
        ? "مفعّلة"
        : "غير مفعّلة";

    status.style.display = "inline-block";
    status.style.padding = "5px 10px";
    status.style.borderRadius = "20px";
    status.style.fontSize = "12px";
    status.style.fontWeight = "600";
    status.style.whiteSpace = "nowrap";

    if (school.is_active) {
        status.style.backgroundColor = "#e6f5eb";
        status.style.color = "#207344";
    } else {
        status.style.backgroundColor = "#fbe9e9";
        status.style.color = "#a52a2a";
    }

    statusCell.appendChild(status);

    // 4. رقم هاتف مدير المدرسة
    const phoneCell = document.createElement("td");
    phoneCell.dir = "auto";

    phoneCell.textContent = school.manager_profile_id
        ? school.manager_phone || "غير مسجّل"
        : "لا يوجد مدير";

    // 5. موقع المدرسة
    const locationCell = document.createElement("td");
    locationCell.textContent = school.location || "—";

    // 6. الإجراءات
    const actionsCell = document.createElement("td");

    const actions = document.createElement("div");
    actions.className = "school-actions";
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "6px";
    actions.style.alignItems = "center";

    actions.append(
        makeButton("تعديل", "btn-secondary", () =>
            openEditSchoolModal(school.id)
        ),
        makeButton(
            school.is_active ? "إيقاف" : "تفعيل",
            "btn-secondary",
            () => toggleSchoolStatus(school.id)
        ),
        makeButton("حذف", "btn-delete", () =>
            openDeleteSchoolConfirmation(school.id)
        )
    );

    actionsCell.appendChild(actions);

    row.append(
        nameCell,
        dateCell,
        statusCell,
        phoneCell,
        locationCell,
        actionsCell
    );

    return row;
}

function createSecondarySchoolRow(school) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = school.name || "مدرسة بدون اسم";

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(school.created_at);

    const managerCell = document.createElement("td");
    managerCell.textContent = school.manager_profile_id
        ? school.manager_name || "اسم المدير غير متوفر"
        : "لا يوجد مدير";

    const phoneCell = document.createElement("td");
    phoneCell.dir = "auto";
    phoneCell.textContent = school.manager_profile_id
        ? school.manager_phone || "غير مسجّل"
        : "—";

    row.append(nameCell, dateCell, managerCell, phoneCell);

    return row;
}

function makeButton(label, className, handler) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;

    button.addEventListener("click", handler);

    return button;
}

/* =========================
   ADD SCHOOL
========================= */

async function addSchool(event) {
    event.preventDefault();

    const name = $("schoolName")?.value.trim();
    const location = $("schoolLocation")?.value.trim();

    if (!name) {
        showToast("يرجى إدخال اسم المدرسة.", "error");
        $("schoolName")?.focus();
        return;
    }

    if (!location) {
        showToast("يرجى إدخال موقع المدرسة.", "error");
        $("schoolLocation")?.focus();
        return;
    }

    const duplicate = dashboardData.schools.some((school) =>
        String(school.name || "").trim().toLocaleLowerCase("ar") ===
        name.toLocaleLowerCase("ar")
    );

    if (duplicate) {
        showToast("هذه المدرسة موجودة مسبقًا.", "error");
        return;
    }

    const button = event.submitter;
    setButtonLoading(button, true, "جارٍ الحفظ...");

    try {
        const { data, error } = await supabaseClientInstance
            .from("schools")
            .insert({
                name,
                location,
                is_active: true
            })
            .select("id, name, created_at, location, is_active")
            .single();

        if (error) throw error;

        if (!data) {
            throw new Error("لم تُرجع قاعدة البيانات بيانات المدرسة.");
        }

        dashboardData.schools.unshift({
            ...data,
            is_active: data.is_active !== false,
            manager_name: "",
            manager_phone: "",
            manager_profile_id: null
        });

        $("schoolForm")?.reset();
        closeSchoolModal();

        renderSchools();
        updateSchoolSelect();
        updateStatistics();

        showToast("تمت إضافة المدرسة بنجاح.", "success");
    } catch (error) {
        console.error("Add school error:", error);

        showToast(
            getErrorMessage(error, "تعذرت إضافة المدرسة."),
            "error"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

/* =========================
   EDIT SCHOOL
========================= */

async function openEditSchoolModal(schoolId) {
    const modal = $("editSchoolModal");
    const fieldsContainer = $("editSchoolFields");

    if (!modal || !fieldsContainer) {
        showToast("نافذة تعديل المدرسة غير مكتملة في HTML.", "error");
        return;
    }

    const editButton = document.activeElement;

    if (editButton instanceof HTMLButtonElement) {
        setButtonLoading(editButton, true, "جارٍ التحميل...");
    }

    try {
        const { data: school, error } = await supabaseClientInstance
            .from("schools")
            .select("id, name, created_at, location, is_active")
            .eq("id", schoolId)
            .single();

        if (error) throw error;

        if (!school) {
            throw new Error("لم يتم العثور على المدرسة.");
        }

        const index = dashboardData.schools.findIndex(
            (item) => String(item.id) === String(schoolId)
        );

        if (index !== -1) {
            Object.assign(dashboardData.schools[index], school, {
                is_active: school.is_active !== false
            });
        }

        if ($("editSchoolId")) {
            $("editSchoolId").value = String(school.id);
        }

        fieldsContainer.replaceChildren();

        function addTextField(key, labelText, value, options = {}) {
            const group = document.createElement("div");
            group.className = "form-group";

            const label = document.createElement("label");
            label.textContent = labelText;

            const input = document.createElement("input");
            input.type = options.type || "text";
            input.id = `editSchoolField_${key}`;
            input.dataset.column = key;
            input.value = value == null ? "" : String(value);
            input.autocomplete = "off";

            label.htmlFor = input.id;

            if (options.readOnly) input.readOnly = true;
            if (options.disabled) input.disabled = true;
            if (options.required) input.required = true;
            if (options.maxLength) input.maxLength = options.maxLength;
            if (options.dir) input.dir = options.dir;

            if (options.placeholder) {
                input.placeholder = options.placeholder;
            }

            group.append(label, input);
            fieldsContainer.appendChild(group);

            return input;
        }

        addTextField("name", "اسم المدرسة", school.name, {
            required: true,
            maxLength: 120
        });

        addTextField(
            "created_at",
            "تاريخ الإنشاء",
            formatDate(school.created_at),
            { readOnly: true }
        );

        const statusGroup = document.createElement("div");
        statusGroup.className = "form-group";

        const statusLabel = document.createElement("label");
        statusLabel.htmlFor = "editSchoolField_is_active";
        statusLabel.textContent = "حالة المدرسة";

        const statusSelect = document.createElement("select");
        statusSelect.id = "editSchoolField_is_active";
        statusSelect.dataset.column = "is_active";

        const activeOption = document.createElement("option");
        activeOption.value = "true";
        activeOption.textContent = "مفعّلة";

        const inactiveOption = document.createElement("option");
        inactiveOption.value = "false";
        inactiveOption.textContent = "غير مفعّلة";

        statusSelect.append(activeOption, inactiveOption);
        statusSelect.value = school.is_active === false ? "false" : "true";

        statusGroup.append(statusLabel, statusSelect);
        fieldsContainer.appendChild(statusGroup);

        addTextField("location", "موقع المدرسة", school.location, {
            required: true,
            maxLength: 200
        });

        // استدعاء مدير المدرسة المرتبط بهذه المدرسة
        const { data: membership, error: membershipError } =
            await supabaseClientInstance
                .from("school_memberships")
                .select("profile_id, school_id, role")
                .eq("school_id", school.id)
                .eq("role", "school_admin")
                .limit(1)
                .maybeSingle();

        if (membershipError) throw membershipError;

        let managerProfile = null;

        if (membership?.profile_id) {
            const { data: profile, error: profileError } =
                await supabaseClientInstance
                    .from("profiles")
                    .select("id, full_name, phone, role")
                    .eq("id", membership.profile_id)
                    .maybeSingle();

            if (profileError) throw profileError;

            managerProfile = profile;
        }

        if (index !== -1) {
            dashboardData.schools[index].manager_profile_id =
                managerProfile?.id || null;

            dashboardData.schools[index].manager_name =
                managerProfile?.full_name || "";

            dashboardData.schools[index].manager_phone =
                managerProfile?.phone || "";
        }

        addTextField(
            "manager_name",
            "اسم المدير",
            managerProfile?.full_name || "لا يوجد مدير مرتبط",
            { readOnly: true }
        );

        const phoneInput = addTextField(
            "manager_phone",
            "رقم هاتف المدير",
            managerProfile?.phone || "",
            {
                type: "tel",
                dir: "ltr",
                maxLength: 30,
                disabled: !managerProfile,
                placeholder: managerProfile
                    ? "أدخل رقم الهاتف"
                    : "لا يوجد مدير مرتبط بالمدرسة"
            }
        );

        phoneInput.dataset.profileId = managerProfile?.id || "";

        modal.classList.remove("hidden");
        modal.hidden = false;
        modal.classList.add("is-open");

        $("editSchoolField_name")?.focus();

        renderSchools();
    } catch (error) {
        console.error("Load school for editing error:", error);

        showToast(
            getErrorMessage(error, "تعذر تحميل بيانات المدرسة."),
            "error"
        );
    } finally {
        if (editButton instanceof HTMLButtonElement) {
            setButtonLoading(editButton, false);
        }
    }
}

function closeEditSchoolModal() {
    const modal = $("editSchoolModal");
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.classList.add("hidden");
    modal.hidden = true;
}

async function updateSchool(event) {
    event.preventDefault();

    const id = $("editSchoolId")?.value;
    const fieldsContainer = $("editSchoolFields");

    if (!id || !fieldsContainer) {
        showToast("تعذر تحديد المدرسة أو حقول التعديل.", "error");
        return;
    }

    const nameInput = $("editSchoolField_name");
    const locationInput = $("editSchoolField_location");
    const statusInput = $("editSchoolField_is_active");
    const phoneInput = $("editSchoolField_manager_phone");

    const name = nameInput?.value.trim();
    const location = locationInput?.value.trim();

    if (!name) {
        showToast("يرجى إدخال اسم المدرسة.", "error");
        nameInput?.focus();
        return;
    }

    if (!location) {
        showToast("يرجى إدخال موقع المدرسة.", "error");
        locationInput?.focus();
        return;
    }

    const duplicate = dashboardData.schools.some((school) =>
        String(school.id) !== String(id) &&
        String(school.name || "").trim().toLocaleLowerCase("ar") ===
        name.toLocaleLowerCase("ar")
    );

    if (duplicate) {
        showToast("يوجد اسم مدرسة مطابق بالفعل.", "error");
        return;
    }

    const updates = {
        name,
        location,
        is_active: statusInput?.value === "true"
    };

    const managerProfileId = phoneInput?.dataset.profileId || "";
    const managerPhone = phoneInput?.value.trim() || "";

    if (managerProfileId && !managerPhone) {
        showToast("يرجى إدخال رقم هاتف المدير.", "error");
        phoneInput?.focus();
        return;
    }

    const button = event.submitter;
    setButtonLoading(button, true, "جارٍ التحديث...");

    try {
        const { data: updatedSchool, error: schoolError } =
            await supabaseClientInstance
                .from("schools")
                .update(updates)
                .eq("id", id)
                .select("id, name, created_at, location, is_active")
                .single();

        if (schoolError) throw schoolError;

        if (!updatedSchool) {
            throw new Error("لم يتم تأكيد تحديث المدرسة.");
        }

        const index = dashboardData.schools.findIndex(
            (school) => String(school.id) === String(id)
        );

        if (index !== -1) {
            Object.assign(dashboardData.schools[index], updatedSchool, {
                is_active: updatedSchool.is_active !== false
            });
        }

        // الهاتف يُحدّث في profiles وليس schools
        if (managerProfileId) {
            const { data: updatedProfile, error: phoneError } =
                await supabaseClientInstance
                    .from("profiles")
                    .update({ phone: managerPhone })
                    .eq("id", managerProfileId)
                    .eq("role", "school_admin")
                    .select("id, full_name, phone")
                    .maybeSingle();

            if (phoneError) {
                console.error("Update manager phone error:", phoneError);

                await loadSchools();
                await loadManagers();

                throw new Error(
                    "تم تحديث المدرسة، لكن تعذر تحديث هاتف المدير. " +
                    getErrorMessage(phoneError, "")
                );
            }

            if (!updatedProfile) {
                await loadSchools();
                await loadManagers();

                throw new Error(
                    "تم تحديث المدرسة، لكن لم يتم تأكيد تحديث هاتف المدير."
                );
            }

            if (index !== -1) {
                dashboardData.schools[index].manager_name =
                    updatedProfile.full_name || "";

                dashboardData.schools[index].manager_phone =
                    updatedProfile.phone || "";

                dashboardData.schools[index].manager_profile_id =
                    updatedProfile.id;
            }
        }

        closeEditSchoolModal();

        await loadSchools();
        await loadManagers();

        updateSchoolSelect();
        updateStatistics();

        showToast("تم تحديث بيانات المدرسة بنجاح.", "success");
    } catch (error) {
        console.error("Update school error:", error);

        showToast(
            getErrorMessage(
                error,
                "تعذر تحديث بيانات المدرسة. تحقق من صلاحيات Supabase."
            ),
            "error"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

/* =========================
   ACTIVATE / DEACTIVATE
========================= */

async function toggleSchoolStatus(schoolId) {
    const school = dashboardData.schools.find(
        (item) => String(item.id) === String(schoolId)
    );

    if (!school) {
        showToast("لم يتم العثور على المدرسة.", "error");
        return;
    }

    const newStatus = !school.is_active;
    const action = newStatus ? "تفعيل" : "إيقاف";

    if (!window.confirm(`هل تريد ${action} مدرسة «${school.name}»؟`)) {
        return;
    }

    try {
        const { data, error } = await supabaseClientInstance
            .from("schools")
            .update({ is_active: newStatus })
            .eq("id", schoolId)
            .select("id, name, created_at, location, is_active")
            .single();

        if (error) throw error;
        if (!data) throw new Error("لم يتم تأكيد تغيير حالة المدرسة.");

        Object.assign(school, data, {
            is_active: data.is_active !== false
        });

        renderSchools();
        updateSchoolSelect();

        showToast(
            newStatus ? "تم تفعيل المدرسة." : "تم إيقاف المدرسة.",
            "success"
        );
    } catch (error) {
        console.error("Toggle school error:", error);

        showToast(
            getErrorMessage(error, "تعذر تغيير حالة المدرسة."),
            "error"
        );
    }
}

/* =========================
   DELETE SCHOOL
========================= */

function openDeleteSchoolConfirmation(schoolId) {
    const school = dashboardData.schools.find(
        (item) => String(item.id) === String(schoolId)
    );

    if (!school) {
        showToast("لم يتم العثور على المدرسة.", "error");
        return;
    }

    schoolPendingDelete = school;

    const modal = $("deleteSchoolModal");

    if (!modal) {
        showToast(
            "أضف نافذة deleteSchoolModal إلى ملف HTML أولًا.",
            "error"
        );

        schoolPendingDelete = null;
        return;
    }

    if ($("deleteSchoolName")) {
        $("deleteSchoolName").textContent = school.name || "المدرسة";
    }

    modal.classList.remove("hidden");
    modal.hidden = false;
    modal.classList.add("is-open");
}

function closeDeleteSchoolModal() {
    const modal = $("deleteSchoolModal");

    if (modal) {
        modal.classList.remove("is-open");
        modal.classList.add("hidden");
        modal.hidden = true;
    }

    schoolPendingDelete = null;
}

async function confirmDeleteSchool() {
    if (!schoolPendingDelete) {
        showToast("لم يتم تحديد مدرسة للحذف.", "error");
        return;
    }

    const school = schoolPendingDelete;
    const button = $("confirmDeleteSchoolBtn");

    setButtonLoading(button, true, "جارٍ الحذف...");

    try {
        const { data, error } = await supabaseClientInstance
            .from("schools")
            .delete()
            .eq("id", school.id)
            .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "لم يتم حذف المدرسة. تحقق من صلاحيات قاعدة البيانات."
            );
        }

        dashboardData.schools = dashboardData.schools.filter(
            (item) => String(item.id) !== String(school.id)
        );

        closeDeleteSchoolModal();

        renderSchools();
        updateSchoolSelect();
        updateStatistics();

        await loadManagers();

        showToast("تم حذف المدرسة.", "success");
    } catch (error) {
        console.error("Delete school error:", error);

        showToast(
            getErrorMessage(
                error,
                "تعذر حذف المدرسة. قد توجد سجلات مرتبطة بها."
            ),
            "error"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

/* =========================
   SCHOOL MANAGEMENT EVENTS
========================= */

function bindSchoolManagementEvents() {
    $("editSchoolForm")?.addEventListener("submit", updateSchool);

    $("schoolSearchSecondary")?.addEventListener(
        "input",
        renderSchools
    );

    $("closeEditSchoolBtn")?.addEventListener(
        "click",
        closeEditSchoolModal
    );

    $("closeEditSchoolModalBtn")?.addEventListener(
        "click",
        closeEditSchoolModal
    );

    $("cancelEditSchoolBtn")?.addEventListener(
        "click",
        closeEditSchoolModal
    );

    $("confirmDeleteSchoolBtn")?.addEventListener(
        "click",
        confirmDeleteSchool
    );

    $("closeDeleteSchoolModalBtn")?.addEventListener(
        "click",
        closeDeleteSchoolModal
    );

    $("closeDeleteSchoolBtn")?.addEventListener(
        "click",
        closeDeleteSchoolModal
    );

    $("cancelDeleteSchoolBtn")?.addEventListener(
        "click",
        closeDeleteSchoolModal
    );

    ["editSchoolModal", "deleteSchoolModal"].forEach((id) => {
        $(id)?.addEventListener("click", (event) => {
            if (event.target !== $(id)) return;

            if (id === "editSchoolModal") {
                closeEditSchoolModal();
            }

            if (id === "deleteSchoolModal") {
                closeDeleteSchoolModal();
            }
        });
    });
}

/* =========================
   MANAGERS: LOAD
========================= */

async function loadManagers() {
    try {
        // جلب ارتباط كل مدير بالمدرسة
        const {
            data: memberships,
            error: membershipsError
        } = await supabaseClientInstance
            .from("school_memberships")
            .select("id, profile_id, school_id, role")
            .eq("role", "school_admin");

        if (membershipsError) throw membershipsError;

        // جلب بيانات المديرين من profiles
        const {
            data: profiles,
            error: profilesError
        } = await supabaseClientInstance
            .from("profiles")
            .select("id, full_name, role, phone")
            .eq("role", "school_admin");

        if (profilesError) throw profilesError;

        const membershipList = memberships || [];
        const profileList = profiles || [];

        // إنشاء قائمة المديرين المستخدمة في صفحة مديري المدارس
        dashboardData.managers = profileList.map((profile) => {
            const membership = membershipList.find(
                (item) =>
                    String(item.profile_id) === String(profile.id)
            );

            const school = membership
                ? dashboardData.schools.find(
                    (item) =>
                        String(item.id) === String(membership.school_id)
                )
                : null;

            return {
                ...profile,
                school_id: membership?.school_id ?? null,
                school_name: school?.name || "مدرسة غير محددة"
            };
        });

        /*
         * ربط بيانات المدير بكل مدرسة.
         * school_memberships.profile_id = profiles.id
         * school_memberships.school_id = schools.id
         */
        dashboardData.schools.forEach((school) => {
            const membership = membershipList.find(
                (item) =>
                    String(item.school_id) === String(school.id)
            );

            const manager = membership
                ? profileList.find(
                    (profile) =>
                        String(profile.id) === String(membership.profile_id)
                )
                : null;

            school.manager_profile_id = manager?.id || null;
            school.manager_name = manager?.full_name || "";
            school.manager_phone = manager?.phone || "";
        });

        renderSchools();
        renderManagers();
        updateStatistics();

    } catch (error) {
        console.error("Load managers error:", error);

        showToast(
            getErrorMessage(error, "تعذر تحميل المديرين."),
            "error"
        );
    }
}

/* =========================
   MANAGERS: DISPLAY
========================= */

function renderManagers() {
    const body = $("managersTableBody");

    const term = ($("managerSearch")?.value || "")
        .trim()
        .toLocaleLowerCase("ar");

    const managers = dashboardData.managers.filter((manager) =>
        String(manager.full_name || "")
            .toLocaleLowerCase("ar")
            .includes(term) ||
        String(manager.school_name || "")
            .toLocaleLowerCase("ar")
            .includes(term) ||
        String(manager.phone || "").includes(term)
    );

    if (body) {
        body.replaceChildren();

        if (managers.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 3;
            cell.textContent = "لا يوجد مديرون مطابقون للبحث.";

            row.appendChild(cell);
            body.appendChild(row);
        } else {
            managers.forEach((manager) => {
                const row = document.createElement("tr");

                const name = document.createElement("td");
                name.textContent =
                    manager.full_name || "مدير بدون اسم";

                const school = document.createElement("td");
                school.textContent =
                    manager.school_name || "مدرسة غير محددة";

                const role = document.createElement("td");
                role.textContent = "مدير مدرسة";

                row.append(name, school, role);
                body.appendChild(row);
            });
        }
    }

    if ($("managerResultsCount")) {
        $("managerResultsCount").textContent =
            `${managers.length} مدير`;
    }

    setElementVisible(
        $("managersEmptyState"),
        managers.length === 0
    );
}

/* =========================
   MANAGER SCHOOL SELECT
========================= */

function updateSchoolSelect() {
    const select = $("managerSchool");
    if (!select) return;

    const previous = select.value;
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "اختر المدرسة";
    select.appendChild(placeholder);

    dashboardData.schools
        .filter((school) => school.is_active !== false)
        .forEach((school) => {
            const option = document.createElement("option");

            option.value = String(school.id);
            option.textContent = school.name || "مدرسة بدون اسم";

            select.appendChild(option);
        });

    if ([...select.options].some(
        (option) => option.value === previous
    )) {
        select.value = previous;
    }
}

/* =========================
   CREATE MANAGER
========================= */

async function createManager(event) {
    event.preventDefault();

    const fullName = $("managerFullName")?.value.trim();
    const email = $("managerEmail")?.value.trim();
    const password = $("managerPassword")?.value;
    const phone = $("managerPhone")?.value.trim();
    const schoolId = $("managerSchool")?.value;

    if (!fullName || !email || !password || !phone || !schoolId) {
        showToast(
            "يرجى ملء الاسم والبريد وكلمة المرور والهاتف والمدرسة.",
            "error"
        );
        return;
    }

    if (phone.length > 30) {
        showToast("رقم الهاتف طويل جدًا.", "error");
        $("managerPhone")?.focus();
        return;
    }

    if (password.length < 8) {
        showToast(
            "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
            "error"
        );
        return;
    }

    const school = dashboardData.schools.find(
        (item) =>
            String(item.id) === String(schoolId) &&
            item.is_active !== false
    );

    if (!school) {
        showToast("اختر مدرسة نشطة وصحيحة.", "error");
        updateSchoolSelect();
        return;
    }

    const button = $("saveManagerBtn");
    setButtonLoading(button, true, "جارٍ إنشاء الحساب...");

    try {
        const { data, error } =
            await supabaseClientInstance.functions.invoke(
                "quick-handler",
                {
                    body: {
                        full_name: fullName,
                        email,
                        password,
                        phone,
                        school_id: schoolId
                    }
                }
            );

        if (error) {
            const details = await getFunctionErrorDetails(error);

            throw new Error(
                details || error.message || "تعذر إنشاء الحساب."
            );
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        if (data?.success !== true) {
            throw new Error(
                "لم تؤكد الوظيفة نجاح إنشاء الحساب. تحقق من سجل الدالة."
            );
        }

        $("managerForm")?.reset();
        closeManagerModal();

        await loadSchools();
        await loadManagers();

        showToast(
            "تم إنشاء حساب مدير المدرسة بنجاح.",
            "success"
        );

    } catch (error) {
        console.error("Create manager error:", error);

        showToast(
            getErrorMessage(
                error,
                "تعذر إنشاء الحساب عبر quick-handler."
            ),
            "error"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

async function getFunctionErrorDetails(error) {
    try {
        if (
            error?.context &&
            typeof error.context.json === "function"
        ) {
            const body = await error.context.json();

            return body?.error || body?.message || "";
        }
    } catch (parseError) {
        console.warn(
            "Could not parse Edge Function error:",
            parseError
        );
    }

    return "";
}

/* =========================
   DASHBOARD STATISTICS
========================= */

function renderDashboard() {
    updateStatistics();
    renderSchools();
    renderManagers();
}

function updateStatistics() {
    if ($("totalSchools")) {
        $("totalSchools").textContent =
            String(dashboardData.schools.length);
    }

    if ($("totalManagers")) {
        $("totalManagers").textContent =
            String(dashboardData.managers.length);
    }

    if ($("recentSchools")) {
        $("recentSchools").textContent =
            String(dashboardData.schools.length);
    }
}

/* =========================
   NAVIGATION
========================= */

function bindNavigationEvents() {
    document.querySelectorAll("[data-view]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();

            if (link.dataset.view) {
                showView(link.dataset.view);
            }
        });
    });

    [
        "welcomeAddSchool",
        "addSchoolBtn",
        "schoolsAddBtn"
    ].forEach((id) => {
        $(id)?.addEventListener("click", (event) => {
            event.preventDefault();
            openSchoolModal();
        });
    });

    $("addManagerBtn")?.addEventListener("click", (event) => {
        event.preventDefault();
        openManagerModal();
    });
}

function showView(viewName) {
    const views = {
        dashboard: "dashboardView",
        schools: "schoolsView",
        managers: "managersView",
        settings: "settingsView"
    };

    if (!views[viewName] || !$(views[viewName])) return;

    Object.entries(views).forEach(([name, id]) => {
        const view = $(id);
        if (!view) return;

        view.classList.toggle("hidden", name !== viewName);
        view.hidden = name !== viewName;
    });

    document.querySelectorAll("[data-view]").forEach((link) => {
        const active = link.dataset.view === viewName;

        link.classList.toggle("active", active);

        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    const titles = {
        dashboard: "لوحة التحكم",
        schools: "إدارة المدارس",
        managers: "مديرو المدارس",
        settings: "الإعدادات"
    };

    if ($("pageTitle")) {
        $("pageTitle").textContent = titles[viewName];
    }

    if ($("breadcrumbCurrent")) {
        $("breadcrumbCurrent").textContent = titles[viewName];
    }
}

/* =========================
   MODALS
========================= */

function openSchoolModal() {
    const modal = $("schoolModal");

    if (!modal) {
        showToast(
            "لم يتم العثور على نافذة إضافة المدرسة.",
            "error"
        );
        return;
    }

    modal.classList.remove("hidden");
    modal.hidden = false;
    modal.classList.add("is-open");

    $("schoolName")?.focus();
}

function closeSchoolModal() {
    const modal = $("schoolModal");
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.classList.add("hidden");
    modal.hidden = true;
}

function openManagerModal(schoolId = null) {
    const activeSchools = dashboardData.schools.filter(
        (school) => school.is_active !== false
    );

    if (activeSchools.length === 0) {
        showToast(
            "أضف مدرسة نشطة أولًا قبل إنشاء حساب مدير.",
            "error"
        );

        showView("schools");
        return;
    }

    updateSchoolSelect();

    const modal = $("managerModal");

    if (!modal) {
        showToast(
            "لم يتم العثور على نافذة إضافة المدير.",
            "error"
        );
        return;
    }

    const select = $("managerSchool");

    if (
        select &&
        schoolId !== null &&
        activeSchools.some(
            (school) => String(school.id) === String(schoolId)
        )
    ) {
        select.value = String(schoolId);
    }

    modal.classList.remove("hidden");
    modal.hidden = false;
    modal.classList.add("is-open");

    $("managerFullName")?.focus();
}

function closeManagerModal() {
    const modal = $("managerModal");
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.classList.add("hidden");
    modal.hidden = true;
}

/* =========================
   FORM EVENTS
========================= */

function bindSchoolEvents() {
    $("schoolForm")?.addEventListener("submit", addSchool);

    // البحث في جدول الرئيسية
    $("schoolSearch")?.addEventListener("input", renderSchools);

    $("closeModalBtn")?.addEventListener(
        "click",
        closeSchoolModal
    );

    $("cancelModalBtn")?.addEventListener(
        "click",
        closeSchoolModal
    );
}

function bindManagerEvents() {
    $("managerForm")?.addEventListener("submit", createManager);
    $("managerSearch")?.addEventListener("input", renderManagers);

    $("closeManagerModalBtn")?.addEventListener(
        "click",
        closeManagerModal
    );

    $("cancelManagerModalBtn")?.addEventListener(
        "click",
        closeManagerModal
    );
}

function bindGeneralEvents() {
    $("logoutBtn")?.addEventListener("click", logout);

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        closeSchoolModal();
        closeManagerModal();
        closeEditSchoolModal();
        closeDeleteSchoolModal();
    });

    ["schoolModal", "managerModal"].forEach((id) => {
        $(id)?.addEventListener("click", (event) => {
            if (event.target !== $(id)) return;

            if (id === "schoolModal") {
                closeSchoolModal();
            }

            if (id === "managerModal") {
                closeManagerModal();
            }
        });
    });
}

/* =========================
   LOGOUT
========================= */

async function logout() {
    if (!supabaseClientInstance) {
        redirectToLogin();
        return;
    }

    try {
        const { error } =
            await supabaseClientInstance.auth.signOut();

        if (error) throw error;

        redirectToLogin();
    } catch (error) {
        console.error("Logout error:", error);
        showToast("تعذر تسجيل الخروج.", "error");
    }
}

/* =========================
   UTILITIES
========================= */

function setElementVisible(element, visible) {
    if (!element) return;

    element.classList.toggle("hidden", !visible);
    element.hidden = !visible;
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("ar-IQ", {
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(date);
}

function showToast(message, type = "info") {
    const toast = $("toast");

    if (!toast) {
        console.log(`[${type}] ${message}`);
        return;
    }

    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.remove("hidden");

    if (toastTimer) {
        window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
        toast.classList.add("hidden");
        toast.hidden = true;
    }, 4500);
}

function setButtonLoading(button, loading, loadingText) {
    if (!button) return;

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;

        if (loadingText) {
            button.textContent = loadingText;
        }

        return;
    }

    button.disabled = false;

    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

function getErrorMessage(error, fallback) {
    if (
        error &&
        typeof error.message === "string" &&
        error.message.trim()
    ) {
        return error.message;
    }

    return fallback;
}
