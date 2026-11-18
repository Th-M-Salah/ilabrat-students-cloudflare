"use strict";

/* ILABRAT Students — authenticated home page. */
document.addEventListener("DOMContentLoaded", async () => {
  const linksContainer = document.getElementById("homeLinks");
  const welcomeMessage = document.getElementById("welcomeMessage");
  const roleBadge = document.getElementById("userRoleBadge");
  const message = document.getElementById("homeMessage");
  const logoutButton = document.getElementById("logoutButton");
  const year = document.getElementById("currentYear");
  if (year) year.textContent = new Date().getFullYear();

  const roleNames = {
    admin: "مدير التطبيق",
    main_admin: "مدير التطبيق",
    school_admin: "مدير المدرسة",
    school_manager: "مدير المدرسة",
    teacher: "المعلم",
    student: "الطالب"
  };

  const destinations = {
    admin: [
      { title: "إدارة التطبيق", description: "إدارة المدارس وحسابات مديري المدارس.", href: "main-admin.html", icon: "⌂" },
      { title: "إدارة الجداول", description: "فتح صفحة الجداول المدرسية.", href: "admin-timetable.html", icon: "▦" }
    ],
    main_admin: [
      { title: "إدارة التطبيق", description: "إدارة المدارس وحسابات مديري المدارس.", href: "main-admin.html", icon: "⌂" },
      { title: "إدارة الجداول", description: "فتح صفحة الجداول المدرسية.", href: "admin-timetable.html", icon: "▦" }
    ],
    school_admin: [
      { title: "إدارة المدرسة", description: "إدارة الجداول والإعلانات المدرسية.", href: "admin-timetable.html", icon: "▦" }
    ],
    school_manager: [
      { title: "إدارة المدرسة", description: "إدارة الجداول والإعلانات المدرسية.", href: "admin-timetable.html", icon: "▦" }
    ],
    teacher: [
      { title: "صفحة المعلم", description: "متابعة الجدول وإدارة محتوى الدروس المتاح لك.", href: "teacher.html", icon: "✎" },
      { title: "عرض الجدول", description: "الانتقال إلى صفحة الجدول الدراسي.", href: "timetable.html", icon: "▦" }
    ],
    student: [
      { title: "جدولي الدراسي", description: "عرض الجدول والإعلانات الدراسية المنشورة لك.", href: "timetable.html", icon: "▦" }
    ]
  };

  function showError(text) {
    if (message) {
      message.textContent = text;
      message.hidden = false;
    }
  }

  function renderCards(items) {
    if (!linksContainer) return;
    linksContainer.replaceChildren();
    items.forEach((item) => {
      const card = document.createElement("a");
      card.className = "home-card";
      card.href = item.href;
      const icon = document.createElement("span");
      icon.className = "card-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon;
      const title = document.createElement("h3");
      title.textContent = item.title;
      const description = document.createElement("p");
      description.textContent = item.description;
      const action = document.createElement("span");
      action.className = "card-action";
      action.textContent = "فتح القسم ←";
      card.append(icon, title, description, action);
      linksContainer.appendChild(card);
    });
  }

  if (!window.supabaseClient || !window.supabaseClient.auth) {
    showError("تعذر الاتصال بخدمة الحسابات. تحقق من ملف supabase-config.js.");
    if (linksContainer) linksContainer.replaceChildren();
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !roleNames[profile.role]) {
      console.error("ILABRAT profile verification error:", profileError);
      await window.supabaseClient.auth.signOut();
      window.location.replace("login.html");
      return;
    }

    const role = profile.role;
    if (roleBadge) roleBadge.textContent = roleNames[role];
    if (welcomeMessage) {
      const name = profile.full_name && profile.full_name.trim() ? profile.full_name.trim() : roleNames[role];
      welcomeMessage.textContent = `مرحبًا ${name}، يمكنك الوصول إلى الأقسام المتاحة لحسابك من هنا.`;
    }
    renderCards(destinations[role] || []);

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "جارٍ تسجيل الخروج...";
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) {
          console.error("ILABRAT sign-out error:", error);
          logoutButton.disabled = false;
          logoutButton.textContent = "تسجيل الخروج";
          showError("تعذر تسجيل الخروج. حاول مرة أخرى.");
          return;
        }
        window.location.replace("login.html");
      });
    }
  } catch (error) {
    console.error("ILABRAT home page error:", error);
    showError("تعذر تحميل الصفحة الرئيسية. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.");
  }
});
