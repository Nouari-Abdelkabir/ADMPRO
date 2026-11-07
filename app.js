// 1. Configuration de Supabase
const SUPABASE_URL = 'https://cavgzajgabfsitxvgvmy.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_kVle3qU5eR1AJO1uSWE6Pg_qaqK0ElZ'; 

const mySupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// دالة تحميل الأقسام ديناميكياً
async function chargerModule(moduleName, event) {
    if (event) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const contentArea = document.getElementById('main-content');
    contentArea.innerHTML = '<p style="text-align:center; padding:50px;">Chargement...</p>';

    try {
        // 1. جلب ملف HTML الخاص بالقسم
        const response = await fetch(`modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error('Module introuvable');
        const html = await response.text();
        contentArea.innerHTML = html;

        // 2. إزالة ملفات CSS القديمة (إن وجدت) وإضافة ملف CSS الجديد
        const oldCss = document.getElementById('dynamic-css');
        if (oldCss) oldCss.remove();

        const link = document.createElement('link');
        link.id = 'dynamic-css';
        link.rel = 'stylesheet';
        link.href = `modules/${moduleName}/${moduleName}.css`;
        document.head.appendChild(link);

        // 3. إزالة ملف JS القديم وتحميل ملف JS الجديد
        const oldJs = document.getElementById('dynamic-js');
        if (oldJs) oldJs.remove();

        const script = document.createElement('script');
        script.id = 'dynamic-js';
        script.src = `modules/${moduleName}/${moduleName}.js`;
        document.body.appendChild(script);

    } catch (error) {
        contentArea.innerHTML = `<p style="color:red; text-align:center; padding:50px;">Erreur: ${error.message}</p>`;
    }
}

// تحميل قسم الإعدادات افتراضياً عند فتح التطبيق
document.addEventListener('DOMContentLoaded', () => {
    chargerModule('parametres');
});