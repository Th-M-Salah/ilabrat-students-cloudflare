
"use strict";

/* =========================================================
   ILABRAT STUDENTS
   HOMEWORK DETAILS
   عرض واجب واحد للطالب مع مرفقاته
   ========================================================= */

(() => {
    const db = window.supabaseClient;

    const $ = id => document.getElementById(id);

    const elements = {
        loading: $("detailsLoading"),
        error: $("detailsError"),
        errorMessage: $("detailsErrorMessage"),

        content: $("homeworkDetailsContent"),

        subject: $("detailsSubject"),
        createdAt: $("detailsCreatedAt"),
        targetDate: $("detailsTargetDate"),
        homeworkText: $("detailsHomeworkText"),

        attachments: $("detailsAttachments"),
        imageCount: $("detailsImageCount"),
        noAttachments: $("detailsNoAttachments"),

        imageViewer: $("detailsImageViewer"),
        viewerImage: $("detailsViewerImage"),
        viewerCaption: $("detailsViewerCaption"),
        closeImageViewer: $("closeDetailsImageViewer")
    };

    const state = {
        user: null,
        post: null
    };

    /* =====================================================
       HELPERS
       ===================================================== */

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

    function safeImageUrl(value) {
        if (!value) return "";

        try {
            const url = new URL(
                String(value),
                window.location.origin
            );

            if (!["https:", "http:"].includes(url.protocol)) {
                return "";
            }

            return url.href;

        } catch {
            return "";
        }
    }

    function formatDate(value) {
        if (!value) return "غير متاح";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "غير متاح";
        }

        return new Intl.DateTimeFormat("ar-IQ", {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(date);
    }

    function showLoading(show) {
        if (elements.loading) {
            elements.loading.hidden = !show;
        }
    }

    function showError(message) {
        showLoading(false);

        if (elements.content) {
            elements.content.hidden = true;
        }

        if (elements.errorMessage) {
            elements.errorMessage.textContent = message;
        }

        if (elements.error) {
            elements.error.hidden = false;
        }
    }

    function showContent() {
        showLoading(false);

        if (elements.error) {
            elements.error.hidden = true;
        }

        if (elements.content) {
            elements.content.hidden = false;
        }
    }

    /* =====================================================
       GET POST ID
       ===================================================== */

    function getPostId() {
        const params = new URLSearchParams(
            window.location.search
        );

        const value = params.get("post_id");

        if (!value || !/^\d+$/.test(value)) {
            return null;
        }

        const id = Number(value);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return null;
        }

        return id;
    }

    /* =====================================================
       AUTHENTICATION
       ===================================================== */

    async function verifyStudent() {
        if (!db?.auth || !db?.functions) {
            throw new Error(
                "تعذر الاتصال بالخدمة. يرجى تحديث الصفحة."
            );
        }

        const { data, error } = await db.auth.getUser();

        if (error) throw error;

        state.user = data?.user || null;

        if (!state.user) {
            window.location.replace("index.html");
            return false;
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("id, role")
            .eq("id", state.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile || profile.role !== "student") {
            throw new Error(
                "هذه الصفحة مخصصة لحسابات الطلبة فقط."
            );
        }

        return true;
    }

    /* =====================================================
       LOAD SELECTED HOMEWORK
       ===================================================== */

    async function loadSelectedHomework(postId) {
        const { data, error } = await db.functions.invoke(
            "homework-handler",
            {
                body: {
                    action: "student_posts"
                }
            }
        );

        if (error) {
            console.error("Homework service error:", error);
            throw new Error(
                "تعذر الاتصال بخدمة الواجبات. حاول مرة أخرى."
            );
        }

        if (!data?.success) {
            throw new Error(
                data?.message ||
                "لم نتمكن من تحميل بيانات الواجب."
            );
        }

        const posts = Array.isArray(data.posts)
            ? data.posts
            : [];

        const post = posts.find(item =>
            Number(item.id) === postId
        );

        if (!post) {
            throw new Error(
                "هذا الواجب غير متاح. ربما انتهت مدة عرضه أو تم حذفه."
            );
        }

        // صفحة التفاصيل مخصصة لواجبات المعلمين.
        // لا نعرض إعلانات إدارة المدرسة على أنها واجبات.
        const isTeacherHomework =
            post.post_type === "teacher_homework" ||
            post.author_role === "teacher";

        if (!isTeacherHomework) {
            throw new Error(
                "العنصر المطلوب ليس واجباً دراسياً متاحاً هنا."
            );
        }

        state.post = post;

        return post;
    }

    /* =====================================================
       RENDER HOMEWORK INFORMATION
       ===================================================== */

    function renderHomework(post) {
        if (elements.subject) {
            elements.subject.textContent =
                post.subject?.trim() ||
                "واجب دراسي";
        }

        if (elements.createdAt) {
            elements.createdAt.textContent =
                formatDate(post.created_at);
        }

        if (elements.targetDate) {
            elements.targetDate.textContent =
                post.target_date
                    ? formatDate(post.target_date)
                    : "غير محدد";
        }

        if (elements.homeworkText) {
            const content = String(post.content || "").trim();

            elements.homeworkText.textContent =
                content || "لم يضف المعلم نصاً لهذا الواجب.";
        }

        renderAttachments(post);
        showContent();
    }

    /* =====================================================
       GET ATTACHMENTS
       ===================================================== */

    function getAttachments(post) {
        const result = [];
        const attachments = Array.isArray(post.attachments)
            ? post.attachments
            : [];

        attachments.forEach(attachment => {
            const url = safeImageUrl(attachment.url);

            if (!url) return;

            result.push({
                url,
                name: attachment.file_name ||
                    "صورة الواجب"
            });
        });

        // دعم الصورة القديمة إن وجدت.
        const legacyImage = safeImageUrl(post.image_url);

        if (
            legacyImage &&
            !result.some(item => item.url === legacyImage)
        ) {
            result.push({
                url: legacyImage,
                name: "صورة الواجب"
            });
        }

        return result;
    }

    /* =====================================================
       RENDER ATTACHMENTS
       ===================================================== */

    function renderAttachments(post) {
        if (!elements.attachments) return;

        const attachments = getAttachments(post);

        if (elements.imageCount) {
            elements.imageCount.textContent =
                `${formatArabicDigits(attachments.length)} صور`;
        }

        if (!attachments.length) {
            elements.attachments.innerHTML = "";

            if (elements.noAttachments) {
                elements.noAttachments.hidden = false;
            }

            return;
        }

        if (elements.noAttachments) {
            elements.noAttachments.hidden = true;
        }

        elements.attachments.innerHTML = attachments
            .map((attachment, index) => `
                <button
                    type="button"
                    class="details-attachment"
                    data-attachment-index="${index}"
                    aria-label="عرض صورة الواجب ${formatArabicDigits(index + 1)}"
                >
                    <img
                        src="${escapeHTML(attachment.url)}"
                        alt="${escapeHTML(attachment.name)}"
                        loading="lazy"
                    >

                    <span class="details-attachment-caption">
                        ${escapeHTML(attachment.name)}
                    </span>
                </button>
            `)
            .join("");

        elements.attachments
            .querySelectorAll("[data-attachment-index]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    const index = Number(
                        button.dataset.attachmentIndex
                    );

                    openImageViewer(attachments[index]);
                });
            });

        // إظهار حالة الصورة عند فشل تحميلها.
        elements.attachments
            .querySelectorAll("img")
            .forEach(image => {
                image.addEventListener("error", () => {
                    image.alt = "تعذر تحميل الصورة";
                    image.style.objectFit = "contain";
                });
            });
    }

    /* =====================================================
       IMAGE VIEWER
       ===================================================== */

    function openImageViewer(attachment) {
        if (
            !attachment ||
            !elements.imageViewer ||
            !elements.viewerImage
        ) {
            return;
        }

        const url = safeImageUrl(attachment.url);

        if (!url) return;

        elements.viewerImage.src = url;

        elements.viewerImage.alt =
            attachment.name || "صورة الواجب";

        if (elements.viewerCaption) {
            elements.viewerCaption.textContent =
                attachment.name || "صورة الواجب";
        }

        if (!elements.imageViewer.open) {
            elements.imageViewer.showModal();
        }
    }

    function closeImageViewer() {
        if (
            elements.imageViewer?.open
        ) {
            elements.imageViewer.close();
        }

        if (elements.viewerImage) {
            elements.viewerImage.removeAttribute("src");
        }
    }

    function bindImageViewerEvents() {
        elements.closeImageViewer?.addEventListener(
            "click",
            closeImageViewer
        );

        elements.imageViewer?.addEventListener(
            "click",
            event => {
                if (event.target === elements.imageViewer) {
                    closeImageViewer();
                }
            }
        );

        elements.imageViewer?.addEventListener(
            "close",
            () => {
                if (elements.viewerImage) {
                    elements.viewerImage.removeAttribute("src");
                }
            }
        );

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                elements.imageViewer?.open
            ) {
                closeImageViewer();
            }
        });
    }

    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {
        showLoading(true);

        const postId = getPostId();

        if (!postId) {
            showError(
                "رابط الواجب غير صحيح. ارجع إلى الجدول واختر الواجب مرة أخرى."
            );
            return;
        }

        try {
            const authenticated = await verifyStudent();

            if (!authenticated) return;

            bindImageViewerEvents();

            const post = await loadSelectedHomework(postId);

            renderHomework(post);

        } catch (error) {
            console.error(
                "Homework details initialization error:",
                error
            );

            showError(
                error?.message ||
                "حدث خطأ أثناء تحميل تفاصيل الواجب."
            );
        }
    }

    initialize();

})();
