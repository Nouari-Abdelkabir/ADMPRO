// ==========================================
// 1. المتغيرات العامة (Global Variables)
// ==========================================
let currentPosteId = null;
let currentMobileNum = 1;
let currentCircuitName = "Patrouilleur 1";
let planningAgentsList = [];
let currentPlanningData = {};
let currentCarteMobile = 'Tous';

// ==========================================
// 2. إدارة الصالات (Salles)
// ==========================================
async function chargerSalles() {
    const { data: salles, error } = await mySupabase.from('salles').select('*').order('nom');
    
    if (error) {
        console.error("Erreur de chargement des salles:", error);
        return;
    }

    if (!salles || salles.length === 0) {
        console.warn("Aucune salle trouvée dans la base de données.");
        return;
    }

    const filterSelect = document.getElementById('filter_salle');
    if (filterSelect) {
        let html = '<option value="">Sélectionnez une Salle</option>';
        salles.forEach(s => {
            html += `<option value="${s.nom}">${s.nom}</option>`;
        });
        filterSelect.innerHTML = html;

        // اختيار مراكش تلقائياً
        let found = false;
        for (let i = 0; i < filterSelect.options.length; i++) {
            if (filterSelect.options[i].value.includes('Marrakech')) {
                filterSelect.selectedIndex = i;
                found = true;
                break;
            }
        }
        // إذا لم نجد مراكش، نختار أول صالة متاحة
        if (!found && filterSelect.options.length > 1) {
            filterSelect.selectedIndex = 1;
        }
    }

    const modalSelect = document.getElementById('np_salle');
    if (modalSelect) {
        let html = '<option value="">Sélectionnez une Salle</option>';
        salles.forEach(s => {
            html += `<option value="${s.nom}">${s.nom}</option>`;
        });
        modalSelect.innerHTML = html;
    }
}

// دالة مساعدة لجلب الصالات لملء القوائم المنسدلة
async function chargerOptionsSalles() {
    const { data: salles } = await mySupabase.from('salles').select('*').order('nom');
    if (!salles) return;

    let html = '<option value="">Sélectionnez une Salle</option>';
    salles.forEach(s => html += `<option value="${s.nom}">${s.nom}</option>`);

    // ملء قوائم الإضافة
    if(document.getElementById('v_salle')) document.getElementById('v_salle').innerHTML = html;
    if(document.getElementById('p_salle')) document.getElementById('p_salle').innerHTML = html;
    if(document.getElementById('pat_salle')) document.getElementById('pat_salle').innerHTML = html;
    if(document.getElementById('planning_salle')) document.getElementById('planning_salle').innerHTML = html;
}

// ==========================================
// 3. التنقل بين الشاشات (Navigation)
// ==========================================
function ouvrirSousVueAssistance(viewId) {
    document.querySelectorAll('.subview').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    
    if (viewId === 'view-liste-postes') {
        chargerPostes();
    }
}

function ouvrirOngletAssistance(tabId, event) {
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    if (event) event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'tab-carte') {
        initialiserCarte();
    }
}

// ==========================================
// 4. إدارة الورديات (Postes)
// ==========================================
async function ouvrirModalNouveauPoste() {
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('edit_poste_id').value = '';
    document.getElementById('modal-title-poste').textContent = 'Commencer un nouveau Poste';
    document.getElementById('form-nouveau-poste').reset();
    
    document.getElementById('np_date').value = today;
    if(document.getElementById('filter_salle').value) {
        document.getElementById('np_salle').value = document.getElementById('filter_salle').value;
    }

    const { data: stds } = await mySupabase.from('patrouilleurs')
        .select('nom').eq('fonction', 'Standardiste').eq('statut', 'Actif').order('nom');
    
    let options = '<option value="">Sélectionnez un Standardiste</option>';
    if (stds) stds.forEach(s => options += `<option value="${s.nom}">${s.nom}</option>`);
    document.getElementById('np_operateur').innerHTML = options;

    document.getElementById('modal-nouveau-poste').style.display = 'flex';
}

function fermerModalNouveauPoste() {
    document.getElementById('modal-nouveau-poste').style.display = 'none';
}

function changerDate(days) {
    const input = document.getElementById('filter_date');
    if (!input.value) return;
    
    let currentDate = new Date(input.value);
    currentDate.setDate(currentDate.getDate() + days);
    
    // تنسيق التاريخ ليكون YYYY-MM-DD
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    input.value = `${year}-${month}-${day}`;
    
    chargerPostes();
}

async function sauvegarderNouveauPoste(event) {
    event.preventDefault();
    const id = document.getElementById('edit_poste_id').value;
    const date = document.getElementById('np_date').value;
    const typePoste = document.getElementById('np_type').value;
    const salle = document.getElementById('np_salle').value;
    const operateur = document.getElementById('np_operateur').value;
    
    if (!typePoste || !salle || !operateur) return alert('Veuillez remplir tous les champs.');
    const heureDebut = typePoste.split(' ')[0];

    if (!id) {
        const { data: existing } = await mySupabase.from('postes_assistance')
            .select('id').eq('date_debut', date).eq('type_poste', typePoste).eq('salle', salle);
        if (existing && existing.length > 0) {
            alert(`⚠️ Le poste ${typePoste} existe déjà pour la salle "${salle}" à la date du ${date}.`);
            return;
        }
    }

    const dataToSave = {
        operateur, date_debut: date, heure_debut: heureDebut, statut: 'Ouvert',
        type_poste: typePoste, salle: salle,
        cles_vehicule: 0, commentaire_cles: '', badge_service: 0, commentaire_badge: '',
        cartes_carburant: 0, commentaire_cartes: '', consignes: ''
    };

    let error;
    if (id) {
        const res = await mySupabase.from('postes_assistance').update(dataToSave).eq('id', id);
        error = res.error;
    } else {
        const res = await mySupabase.from('postes_assistance').insert([dataToSave]);
        error = res.error;
    }

    if (error) alert('Erreur: ' + error.message);
    else {
        fermerModalNouveauPoste();
        document.getElementById('filter_date').value = date;
        document.getElementById('filter_salle').value = salle;
        chargerPostes();
    }
}

async function chargerPostes() {
    const tbody = document.getElementById('postes-list-body');
    if (!tbody) return;

    // 1. جلب الصالات إذا كانت القائمة فارغة
    const filterSalleSelect = document.getElementById('filter_salle');
    if (filterSalleSelect.options.length <= 1) {
        await chargerSalles();
    }

    // 2. تعيين تاريخ اليوم إذا كان الحقل فارغاً
    let filterDate = document.getElementById('filter_date').value;
    if (!filterDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        filterDate = `${year}-${month}-${day}`;
        document.getElementById('filter_date').value = filterDate;
    }

    // 3. قراءة الصالة المختارة
    let filterSalle = document.getElementById('filter_salle').value;

    // 4. جلب الورديات من قاعدة البيانات
    const { data, error } = await mySupabase.from('postes_assistance')
        .select('*')
        .eq('date_debut', filterDate)
        .eq('salle', filterSalle)
        .order('heure_debut', { ascending: true });
    
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Erreur: ${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Aucun poste pour cette salle à cette date.</td></tr>`;
        return;
    }

    // 5. عرض الورديات
    tbody.innerHTML = data.map(p => {
        let actionButtons = '';
        if (p.statut === 'Ouvert') {
            actionButtons = `
                <button class="btn btn-blue" onclick="voirDetailsPoste('${p.id}')" style="font-size:12px; padding:5px 10px;">ℹ️ Détails</button>
                <button class="btn btn-edit" onclick="editerPoste('${p.id}')" style="font-size:12px; padding:5px 10px; background:#f59e0b; margin-left:5px;">✏️ Modifier</button>
                <button class="btn-valide" onclick="validerPoste('${p.id}', '${p.date_debut}', '${p.heure_debut}')">✔ VALIDER</button>
            `;
        } else if (p.statut === 'Validé') {
            actionButtons = `
                <button class="btn btn-blue" onclick="voirDetailsPoste('${p.id}')" style="font-size:12px; padding:5px 10px;">ℹ️ Détails</button>
                <button class="btn btn-secondary" onclick="consulterPoste('${p.id}')" style="font-size:12px; padding:5px 10px; background:#6b7280; color:white; margin-left:5px;">👁️ Consulter</button>
                <button class="btn btn-red" onclick="deverrouillerPoste('${p.id}')" style="font-size:12px; padding:5px 10px; margin-left:5px;">🔓 Déverrouiller</button>
            `;
        }
        return `
            <tr>
                <td><strong>${p.type_poste || 'N/A'}</strong> <span class="badge-cloture" style="${p.statut === 'Validé' ? 'background:#d1fae5; color:#065f46;' : 'background:#fef3c7; color:#92400e;'}">${p.statut}</span></td>
                <td>${p.operateur}</td>
                <td>${p.date_debut}</td>
                <td>${p.heure_debut}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

async function validerPoste(id, dateStr, heureStr) {
    const dateDebutPoste = new Date(`${dateStr}T${heureStr}:00`);
    const now = new Date();
    const diffMinutes = (now - dateDebutPoste) / (1000 * 60);

    if (diffMinutes < 15) return alert("⚠️ Vous ne pouvez pas valider le poste avant 15 minutes après son démarrage.");
    if (!confirm("Êtes-vous sûr de vouloir VALIDER ce poste ?")) return;

    const { error } = await mySupabase.from('postes_assistance').update({ statut: 'Validé' }).eq('id', id);
    if (error) alert("Erreur: " + error.message);
    else chargerPostes();
}

async function deverrouillerPoste(id) {
    const CODE_SECRET = "ADMIN123";
    const code = prompt("🔐 Entrez le code administrateur :\n(Code par défaut : ADMIN123)");
    
    if (!code) return;
    if (code !== CODE_SECRET) return alert("❌ Code incorrect. Accès refusé.");
    if (!confirm("⚠️ Déverrouiller ce poste ?")) return;

    const { error } = await mySupabase.from('postes_assistance').update({ statut: 'Ouvert' }).eq('id', id);
    if (error) alert("Erreur: " + error.message);
    else {
        alert("✅ Le poste a été déverrouillé.");
        chargerPostes();
    }
}

async function editerPoste(id) {
    const { data, error } = await mySupabase.from('postes_assistance').select('*').eq('id', id).single();
    if (error) return;

    document.getElementById('edit_poste_id').value = id;
    document.getElementById('modal-title-poste').textContent = 'Modifier le Poste';
    document.getElementById('np_date').value = data.date_debut;
    document.getElementById('np_type').value = data.type_poste;
    document.getElementById('np_salle').value = data.salle;

    const { data: stds } = await mySupabase.from('patrouilleurs').select('nom').eq('fonction', 'Standardiste').eq('statut', 'Actif').order('nom');
    let options = '<option value="">Sélectionnez un Standardiste</option>';
    if (stds) stds.forEach(s => options += `<option value="${s.nom}">${s.nom}</option>`);
    document.getElementById('np_operateur').innerHTML = options;
    if (data.operateur) document.getElementById('np_operateur').value = data.operateur;

    document.getElementById('modal-nouveau-poste').style.display = 'flex';
}

// ==========================================
// 5. تفاصيل الوردية (Détails & Passation)
// ==========================================
async function voirDetailsPoste(id) {
    currentPosteId = id;
    const { data: poste } = await mySupabase.from('postes_assistance').select('*').eq('id', id).single();
    
    document.getElementById('details-title').textContent = `Détail du poste ${poste.type_poste} (${poste.date_debut})`;
    
    try { await chargerOptionsDetails(); } catch(e) { console.log(e); }
    try { await chargerOptionsSignature(); } catch(e) { console.log(e); }

    const { data: passationData } = await mySupabase.from('poste_details').select('*').eq('poste_id', id).eq('mobile_num', 0).single();

    if (passationData) {
        if (document.getElementById('f_cles_nb')) document.getElementById('f_cles_nb').value = passationData.cles_vehicule || 0;
        if (document.getElementById('f_cles_com')) document.getElementById('f_cles_com').value = passationData.commentaire_cles || '';
        if (document.getElementById('f_badge_nb')) document.getElementById('f_badge_nb').value = passationData.badge_service || 0;
        if (document.getElementById('f_badge_com')) document.getElementById('f_badge_com').value = passationData.commentaire_badge || '';
        if (document.getElementById('f_cartes_nb')) document.getElementById('f_cartes_nb').value = passationData.cartes_carburant || 0;
        if (document.getElementById('f_cartes_com')) document.getElementById('f_cartes_com').value = passationData.commentaire_cartes || '';
        if (document.getElementById('f_consignes')) document.getElementById('f_consignes').value = passationData.consignes || '';
        if (document.getElementById('f_std_sortant')) document.getElementById('f_std_sortant').value = passationData.std_sortant || '';
        if (document.getElementById('f_std_entrant')) document.getElementById('f_std_entrant').value = passationData.std_entrant || '';
    } else {
        if (document.getElementById('f_cles_nb')) document.getElementById('f_cles_nb').value = 0;
        if (document.getElementById('f_cles_com')) document.getElementById('f_cles_com').value = '';
        if (document.getElementById('f_badge_nb')) document.getElementById('f_badge_nb').value = 0;
        if (document.getElementById('f_badge_com')) document.getElementById('f_badge_com').value = '';
        if (document.getElementById('f_cartes_nb')) document.getElementById('f_cartes_nb').value = 0;
        if (document.getElementById('f_cartes_com')) document.getElementById('f_cartes_com').value = '';
        if (document.getElementById('f_consignes')) document.getElementById('f_consignes').value = '';
    }
    ouvrirSousVueAssistance('view-details-poste');
}

async function chargerOptionsDetails() {
    const { data: resp } = await mySupabase.from('patrouilleurs').select('*').eq('statut', 'Actif').order('nom');
    
    let optionsStandardiste = '<option value="">Sélectionnez Standardiste...</option>';
    let optionsPatrouilleurs = '<option value="">Sélectionnez Patrouilleur...</option>';
    
    if (resp) {
        resp.forEach(r => {
            if (r.fonction === 'Standardiste') optionsStandardiste += `<option value="${r.nom}">${r.nom}</option>`;
            else optionsPatrouilleurs += `<option value="${r.nom}">${r.nom}</option>`;
        });
    }
    
    if (document.getElementById('f_standardiste')) document.getElementById('f_standardiste').innerHTML = optionsStandardiste;
    if (document.getElementById('f_patrouilleur_1')) document.getElementById('f_patrouilleur_1').innerHTML = optionsPatrouilleurs;
    if (document.getElementById('f_patrouilleur_2')) document.getElementById('f_patrouilleur_2').innerHTML = optionsPatrouilleurs;

    const { data: vehicules } = await mySupabase.from('vehicules').select('*').order('matricule');
    let optionsVehicules = '<option value="">Sélectionnez Véhicule...</option>';
    if (vehicules) vehicules.forEach(v => optionsVehicules += `<option value="${v.matricule}">${v.matricule} (${v.marque})</option>`);
    if (document.getElementById('f_vehicule')) document.getElementById('f_vehicule').innerHTML = optionsVehicules;

    const { data: troncons } = await mySupabase.from('troncons').select('*').order('id');
    let tronconHtml = '<option value="">Sélectionnez Tronçon...</option>';
    if (troncons) troncons.forEach(t => tronconHtml += `<option value="${t.id}">${t.id} (${t.name})</option>`);
    if (document.getElementById('f_troncon')) document.getElementById('f_troncon').innerHTML = tronconHtml;
}

async function chargerOptionsSignature() {
    const { data } = await mySupabase.from('patrouilleurs').select('*').eq('fonction', 'Standardiste').eq('statut', 'Actif').order('nom');
    let html = '<option value="">-- Choisir --</option>';
    if(data) data.forEach(p => html += `<option value="${p.nom}">${p.nom}</option>`);
    
    if (document.getElementById('f_std_sortant')) document.getElementById('f_std_sortant').innerHTML = html;
    if (document.getElementById('f_std_entrant')) document.getElementById('f_std_entrant').innerHTML = html;
}

async function sauvegarderPassation() {
    if (!currentPosteId) return alert('Aucun poste sélectionné.');

    const dataToSave = {
        poste_id: currentPosteId, mobile_num: 0,
        cles_vehicule: parseInt(document.getElementById('f_cles_nb').value) || 0,
        commentaire_cles: document.getElementById('f_cles_com').value,
        badge_service: parseInt(document.getElementById('f_badge_nb').value) || 0,
        commentaire_badge: document.getElementById('f_badge_com').value,
        cartes_carburant: parseInt(document.getElementById('f_cartes_nb').value) || 0,
        commentaire_cartes: document.getElementById('f_cartes_com').value,
        consignes: document.getElementById('f_consignes').value,
        std_sortant: document.getElementById('f_std_sortant').value,
        std_entrant: document.getElementById('f_std_entrant').value
    };

    const { data: existing } = await mySupabase.from('poste_details').select('id').eq('poste_id', currentPosteId).eq('mobile_num', 0).single();
    let error;

    if (existing) {
        const res = await mySupabase.from('poste_details').update(dataToSave).eq('id', existing.id);
        error = res.error;
    } else {
        const res = await mySupabase.from('poste_details').insert([dataToSave]);
        error = res.error;
    }

    if (error) alert("Erreur: " + error.message);
    else alert("✅ Fiche passation enregistrée !");
}

// ==========================================
// 6. المعاينة (Consulter)
// ==========================================
async function consulterPoste(id) {
    const { data: poste } = await mySupabase.from('postes_assistance').select('*').eq('id', id).single();
    const { data: passation } = await mySupabase.from('poste_details').select('*').eq('poste_id', id).eq('mobile_num', 0).single();

    if (poste) {
        document.getElementById('p_poste_num').textContent = poste.type_poste || '-';
        document.getElementById('p_date_poste').textContent = poste.date_debut || '-';
        document.getElementById('p_heure_debut').textContent = poste.heure_debut || '-';
    }

    if (passation) {
        document.getElementById('p_cles').textContent = passation.cles_vehicule || 0;
        document.getElementById('p_cles_com').textContent = passation.commentaire_cles || '-';
        document.getElementById('p_badge').textContent = passation.badge_service || 0;
        document.getElementById('p_badge_com').textContent = passation.commentaire_badge || '-';
        document.getElementById('p_cartes').textContent = passation.cartes_carburant || 0;
        document.getElementById('p_cartes_com').textContent = passation.commentaire_cartes || '-';
        document.getElementById('p_consignes').textContent = passation.consignes || 'Aucune consigne.';
        document.getElementById('p_std_sortant').textContent = passation.std_sortant || '-';
        document.getElementById('p_std_entrant').textContent = passation.std_entrant || '-';
    } else {
        document.getElementById('p_cles').textContent = '0';
        document.getElementById('p_cles_com').textContent = '-';
        document.getElementById('p_badge').textContent = '0';
        document.getElementById('p_badge_com').textContent = '-';
        document.getElementById('p_cartes').textContent = '0';
        document.getElementById('p_cartes_com').textContent = '-';
        document.getElementById('p_consignes').textContent = 'Aucune consigne.';
        document.getElementById('p_std_sortant').textContent = '-';
        document.getElementById('p_std_entrant').textContent = '-';
    }
    document.getElementById('modal-consulter-poste').style.display = 'flex';
}

// ==========================================
// 7. إدارة Paramétrage
// ==========================================
function ouvrirSousOngletParam(tabId, event) {
    document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
    
    if(event) event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'param-salles') chargerSallesListe(); // <--- جديد
    if (tabId === 'param-vehicules') chargerVehicules();
    if (tabId === 'param-points') chargerPoints();
    if (tabId === 'param-patrouilleurs') chargerPatrouilleurs();
    if (tabId === 'param-circuit') initialiserCircuit();
    if (tabId === 'param-planning') {
        // جلب الصالات لملء القائمة المنسدلة
        chargerOptionsSalles().then(() => {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if(!document.getElementById('planning_month').value) {
                document.getElementById('planning_month').value = currentMonth;
            }
            chargerPlanning();
        });
    }
}

// --- إدارة السيارات (Véhicules) ---
// --- إدارة السيارات (Véhicules) ---

// فتح النافذة (إضافة أو تعديل)
async function ouvrirModalVehicule(id = null) { 
    document.getElementById('v_edit_id').value = id || '';
    
    // جلب الصالات لملء القائمة المنسدلة
    await chargerOptionsSalles(); 
    await chargerOptionsAxes();

    if (id) {
        document.getElementById('modal-title-vehicule').textContent = 'Modifier un véhicule';
        mySupabase.from('vehicules').select('*').eq('id', id).single().then(({data}) => {
            if(data) {
                document.getElementById('v_matricule').value = data.matricule;
                document.getElementById('v_marque').value = data.marque;
                document.getElementById('v_salle').value = data.salle; // نقرأ من العمود الجديد salle
            }
        });
    } else {
        document.getElementById('modal-title-vehicule').textContent = 'Ajouter un véhicule';
        document.querySelector('#modal-vehicule form').reset();
    }
    document.getElementById('modal-vehicule').style.display = 'flex'; 
}

function fermerModalVehicule() { 
    document.getElementById('modal-vehicule').style.display = 'none'; 
}

// جلب وعرض السيارات
async function chargerVehicules() {
    const tbody = document.getElementById('vehicules-list-body');
    if (!tbody) return;
    const { data, error } = await mySupabase.from('vehicules').select('*').order('matricule');
    if (error) return;

    if (data.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucun véhicule.</td></tr>`; 
        return; 
    }

    tbody.innerHTML = data.map(v => `
        <tr>
            <td><strong>${v.matricule}</strong></td>
            <td>${v.marque}</td>
            <td>${v.salle || '-'}</td>
            <td>${v.axe || '-'}</td> <!-- الخلية الجديدة هنا -->
            <td>
                <button class="btn btn-blue" onclick="ouvrirModalVehicule('${v.id}')" style="padding:5px 10px; background:#3b82f6; margin-right:5px;">✏️</button>
                <button class="btn btn-red" onclick="supprimerVehicule('${v.id}')" style="padding:5px 10px;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// حفظ (إضافة أو تعديل)
async function sauvegarderVehicule(event) {
    event.preventDefault();
    const id = document.getElementById('v_edit_id').value;
    const matricule = document.getElementById('v_matricule').value.trim();
    const marque = document.getElementById('v_marque').value.trim();
    const salle = document.getElementById('v_salle').value; // نقرأ من الحقل الجديد
    const axe = document.getElementById('v_axe').value; // 
    const dataToSave = { matricule, marque, salle, axe };  // نحفظ في العمود الجديد salle
    let error;

    if (id) {
        const res = await mySupabase.from('vehicules').update(dataToSave).eq('id', id);
        error = res.error;
    } else {
        const res = await mySupabase.from('vehicules').insert([dataToSave]);
        error = res.error;
    }

    if (error) alert("Erreur: " + error.message);
    else { 
        fermerModalVehicule(); 
        chargerVehicules(); 
    }
}

async function supprimerVehicule(id) {
    if (!confirm('Supprimer ce véhicule ?')) return;
    await mySupabase.from('vehicules').delete().eq('id', id);
    chargerVehicules();
}




// --- إدارة نقاط العلام (Points de repère) ---
// --- إدارة نقاط العلام (Points de repère) ---

// فتح النافذة (إضافة أو تعديل)
async function ouvrirModalPoint(id = null) { 
    document.getElementById('p_edit_id').value = id || '';
    
    // جلب الصالات لملء القائمة المنسدلة
    await chargerOptionsSalles();
    await chargerOptionsAxes();

    if (id) {
        document.getElementById('modal-point').querySelector('h3').textContent = 'Modifier un point de repère';
        mySupabase.from('points_repere').select('*').eq('id', id).single().then(({data}) => {
            if(data) {
                document.getElementById('p_libelle').value = data.libelle;
                document.getElementById('p_pk').value = data.pk;
                document.getElementById('p_salle').value = data.salle; // نقرأ من العمود الجديد
            }
        });
    } else {
        document.getElementById('modal-point').querySelector('h3').textContent = 'Ajouter un point de repère';
        document.querySelector('#modal-point form').reset();
    }
    document.getElementById('modal-point').style.display = 'flex'; 
}

function fermerModalPoint() { 
    document.getElementById('modal-point').style.display = 'none'; 
}

// جلب وعرض نقاط العلام
async function chargerPoints() {
    const tbody = document.getElementById('points-list-body');
    if (!tbody) return;
    const { data, error } = await mySupabase.from('points_repere').select('*').order('pk');
    if (error) return;

    if (data.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucun point de repère.</td></tr>`; 
        return; 
    }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td><strong>${p.libelle}</strong></td>
            <td>${p.pk || '-'}</td>
            <td>${p.salle || '-'}</td>
            <td>${p.axe || '-'}</td> <!-- الخلية الجديدة هنا -->
            <td>
                <button class="btn btn-blue" onclick="ouvrirModalPoint('${p.id}')" style="padding:5px 10px; background:#3b82f6; margin-right:5px;">✏️</button>
                <button class="btn btn-red" onclick="supprimerPoint('${p.id}')" style="padding:5px 10px;">🗑️</button>
            </td>
        </tr>
    `).join('');
}
// حفظ (إضافة أو تعديل)
async function sauvegarderPoint(event) {
    event.preventDefault();
    const id = document.getElementById('p_edit_id').value;
    const libelle = document.getElementById('p_libelle').value.trim();
    const pk = parseFloat(document.getElementById('p_pk').value);
    const salle = document.getElementById('p_salle').value; // نقرأ من الحقل الجديد
    const axe = document.getElementById('p_axe').value;
    const dataToSave = { libelle, pk, salle, axe }; // نحفظ في العمود الجديد
    let error;

    if (id) {
        const res = await mySupabase.from('points_repere').update(dataToSave).eq('id', id);
        error = res.error;
    } else {
        const res = await mySupabase.from('points_repere').insert([dataToSave]);
        error = res.error;
    }

    if (error) alert("Erreur: " + error.message);
    else { 
        fermerModalPoint(); 
        chargerPoints(); 
    }
}

async function supprimerPoint(id) {
    if (!confirm('Supprimer ce point ?')) return;
    await mySupabase.from('points_repere').delete().eq('id', id);
    chargerPoints();
}




// --- إدارة المناوبين (Patrouilleurs) ---
async function ouvrirModalPatrouilleur(id = null) { 
    document.getElementById('pat_edit_id').value = id || '';
    
    // جلب الصالات والمحاور لملء القوائم
    await chargerOptionsSalles();
    await chargerOptionsAxes();

    if (id) {
        document.getElementById('modal-title-patrouilleur').textContent = 'Modifier un Patrouilleur';
        mySupabase.from('patrouilleurs').select('*').eq('id', id).single().then(({data}) => {
            if(data) {
                document.getElementById('pat_nom').value = data.nom;
                document.getElementById('pat_fonction').value = data.fonction || 'Patrouilleur';
                document.getElementById('pat_salle').value = data.salle || data.centre; // نقرأ من salle أو centre
                document.getElementById('pat_axe').value = data.axe || '';
                document.getElementById('pat_is_remplacant').value = data.is_remplacant ? 'true' : 'false';
            }
        });
    } else {
        document.getElementById('modal-title-patrouilleur').textContent = 'Ajouter un Patrouilleur';
        document.querySelector('#modal-patrouilleur form').reset();
        document.getElementById('pat_is_remplacant').value = 'false';
    }
    document.getElementById('modal-patrouilleur').style.display = 'flex'; 
}



function fermerModalPatrouilleur() { document.getElementById('modal-patrouilleur').style.display = 'none'; }

async function chargerPatrouilleurs() {
    const tbody = document.getElementById('patrouilleurs-list-body');
    if (!tbody) return;
    const { data, error } = await mySupabase.from('patrouilleurs').select('*').order('nom');
    if (error) return;

    if (data.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Aucun patrouilleur.</td></tr>`; 
        return; 
    }

    tbody.innerHTML = data.map(p => {
        const isInactif = p.statut === 'Inactif';
        const isRemplacant = p.is_remplacant === true;
        const badgeStatut = isInactif 
            ? `<span style="background:#fee2e2; color:#991b1b; padding:3px 8px; border-radius:12px; font-size:12px;">Inactif</span>` 
            : `<span style="background:#d1fae5; color:#065f46; padding:3px 8px; border-radius:12px; font-size:12px;">Actif</span>`;
        const badgeType = isRemplacant 
            ? `<span style="background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:12px; font-size:12px;">Remplaçant</span>` 
            : `<span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:12px; font-size:12px;">Titulaire</span>`;
        const btnAction = isInactif 
            ? `<button class="btn btn-green" onclick="changerStatut('${p.id}', 'Actif')" style="padding:5px 10px; margin-right:5px;">✅ Activer</button>` 
            : `<button class="btn btn-red" onclick="changerStatut('${p.id}', 'Inactif')" style="padding:5px 10px; margin-right:5px;">🚫 Désactiver</button>`;

        return `
        <tr>
            <td><strong>${p.nom}</strong></td>
            <td>${p.fonction || '-'}</td>
            <td>${p.salle || '-'}</td> <!-- نعرض العمود الجديد -->
            <td>${p.axe || '-'}</td>
            <td>${badgeType}</td>
            <td>${badgeStatut}</td>
            <td>
                ${btnAction}
                <button class="btn btn-blue" onclick="ouvrirModalPatrouilleur('${p.id}')" style="padding:5px 10px; background:#3b82f6; margin-right:5px;">✏️</button>
                <button class="btn btn-red" onclick="supprimerPatrouilleur('${p.id}')" style="padding:5px 10px;">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}

async function changerStatut(id, nouveauStatut) {
    if (nouveauStatut === 'Inactif') {
        const { data: agents } = await mySupabase.from('patrouilleurs').select('*').eq('statut', 'Actif');
        let options = '<option value="">-- Choisir un remplaçant --</option>';
        if (agents) agents.forEach(a => { if (a.id !== id) options += `<option value="${a.id}">${a.nom} (${a.fonction})</option>`; });
        const modalHtml = `
            <div style="background:white; padding:20px; border-radius:8px; width:400px; text-align:center;">
                <h3>Désactiver l'agent</h3><p>Veuillez choisir un remplaçant permanent :</p>
                <select id="select_remplacant" style="width:100%; padding:10px; margin-bottom:15px;">${options}</select>
                <button onclick="confirmerDesactivation('${id}')" style="background:#ef4444; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">Confirmer</button>
                <button onclick="fermerModalRemplacant()" style="background:#ccc; padding:10px 20px; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">Annuler</button>
            </div>`;
        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-remplacant';
        modalDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;';
        modalDiv.innerHTML = modalHtml;
        document.body.appendChild(modalDiv);
    } else {
        if (!confirm("Voulez-vous réactiver cet agent ?")) return;
        const { error } = await mySupabase.from('patrouilleurs').update({ statut: 'Actif', remplacant_id: null }).eq('id', id);
        if (error) alert("Erreur: " + error.message);
        else chargerPatrouilleurs();
    }
}

function fermerModalRemplacant() { const modal = document.getElementById('modal-remplacant'); if (modal) modal.remove(); }

async function confirmerDesactivation(id) {
    const remplacantId = document.getElementById('select_remplacant').value;
    if (!remplacantId) return alert('Veuillez choisir un remplaçant.');
    const { error } = await mySupabase.from('patrouilleurs').update({ statut: 'Inactif', remplacant_id: remplacantId }).eq('id', id);
    if (error) alert("Erreur: " + error.message);
    else { fermerModalRemplacant(); chargerPatrouilleurs(); }
}

async function sauvegarderPatrouilleur(event) {
    event.preventDefault();
    const id = document.getElementById('pat_edit_id').value;
    const nom = document.getElementById('pat_nom').value.trim();
    const fonction = document.getElementById('pat_fonction').value;
    const salle = document.getElementById('pat_salle').value;
    const axe = document.getElementById('pat_axe').value;
    const is_remplacant = document.getElementById('pat_is_remplacant').value === 'true';

    // البيانات التي سيتم حفظها (بدون centre)
    const dataToSave = { 
        nom, 
        fonction, 
        salle: salle, 
        axe, 
        is_remplacant 
    };

    let error;

    if (id) {
        const res = await mySupabase.from('patrouilleurs').update(dataToSave).eq('id', id);
        error = res.error;
    } else {
        const res = await mySupabase.from('patrouilleurs').insert([{ ...dataToSave, statut: 'Actif' }]);
        error = res.error;
    }

    if (error) alert("Erreur: " + error.message);
    else { 
        fermerModalPatrouilleur(); 
        chargerPatrouilleurs(); 
        document.querySelector('#modal-patrouilleur form').reset(); 
    }
}

async function supprimerPatrouilleur(id) {
    if (!confirm('Supprimer ce patrouilleur ?')) return;
    await mySupabase.from('patrouilleurs').delete().eq('id', id);
    chargerPatrouilleurs();
}

// --- إدارة المسارات (Circuits) ---
function changerCircuit(num, event) {
    currentCircuitName = `Patrouilleur ${num}`;
    document.querySelectorAll('#circuits-nav .mobile-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    chargerListeCircuit(currentCircuitName);
}

async function initialiserCircuit() {
    const { data: points } = await mySupabase.from('points_repere').select('*').order('pk');
    let htmlPoints = '<option value="">-- Choisir un point --</option>';
    if(points) points.forEach(p => htmlPoints += `<option value="${p.id}">${p.libelle} (PK: ${p.pk})</option>`);
    document.getElementById('circuit_point_select').innerHTML = htmlPoints;
    chargerListeCircuit(currentCircuitName);
}

async function chargerListeCircuit(nomCircuit) {
    const tbody = document.getElementById('circuit-list-body');
    const { data: circuitsData, error } = await mySupabase.from('circuits').select('*').eq('nom_circuit', nomCircuit).not('point_repere_id', 'is', null).order('ordre', { ascending: true });
    if (error) { alert("Erreur chargement: " + error.message); return; }
    if (!circuitsData || circuitsData.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucun point dans ce circuit.</td></tr>`; return; }
    const { data: pointsData } = await mySupabase.from('points_repere').select('*');
    tbody.innerHTML = circuitsData.map(c => {
        const point = pointsData.find(p => p.id === c.point_repere_id);
        const libelle = point ? point.libelle : 'Point inconnu';
        const pk = point ? point.pk : '-';
        return `<tr><td><strong>${libelle}</strong></td><td>${pk}</td><td>${c.ordre}</td><td><button class="btn btn-red" onclick="supprimerPointCircuit('${c.id}')" style="padding:5px 10px;">🗑️</button></td></tr>`;
    }).join('');
}

async function ajouterPointAuCircuit() {
    const pointId = document.getElementById('circuit_point_select').value;
    const ordre = parseInt(document.getElementById('circuit_ordre').value);
    if (!pointId || isNaN(ordre)) return alert('Veuillez choisir un point et un ordre.');
    const { error } = await mySupabase.from('circuits').insert([{ nom_circuit: currentCircuitName, point_repere_id: pointId, ordre: ordre }]);
    if (error) alert("Erreur d'ajout: " + error.message);
    else { document.getElementById('circuit_ordre').value = ''; chargerListeCircuit(currentCircuitName); }
}

async function supprimerPointCircuit(id) {
    if (!confirm('Supprimer ce point du circuit ?')) return;
    await mySupabase.from('circuits').delete().eq('id', id);
    chargerListeCircuit(currentCircuitName);
}

// --- إدارة الجدول الشهري (Planning) ---
async function chargerPlanning() {
    const month = document.getElementById('planning_month').value;
    const salle = document.getElementById('planning_salle').value;
    if (!month || !salle) return;

    // 1. جلب المناوبين الأساسيين النشطين
    const { data: baseAgents } = await mySupabase.from('patrouilleurs')
        .select('*')
        .eq('salle', salle) // <--- تم التغيير إلى salle
        .eq('statut', 'Actif')
        .eq('is_remplacant', false) 
        .order('ordre', { ascending: true });
    
    // 2. جلب جميع المناوبين (للبحث عن البدلاء)
    const { data: allAgents } = await mySupabase.from('patrouilleurs').select('*').eq('salle', salle); // <--- تم التغيير
    
    let agents = [];
    if (baseAgents) {
        baseAgents.forEach(agent => agents.push(agent));
    }

    // 3. البحث عن المعطلين واستبدالهم بالبدلاء
    const { data: inactifs } = await mySupabase.from('patrouilleurs')
        .select('*')
        .eq('salle', salle) // <--- تم التغيير
        .eq('statut', 'Inactif')
        .eq('is_remplacant', false)
        .not('remplacant_id', 'is', null);

    if (inactifs && allAgents) {
        inactifs.forEach(agent => {
            const remplacant = allAgents.find(a => a.id === agent.remplacant_id);
            if (remplacant) agents.push({ ...remplacant, ordre: agent.ordre, nom: remplacant.nom + " (Remplaçant)" });
        });
    }
    agents.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

    if (agents.length === 0) {
        document.getElementById('planning-tbody').innerHTML = `<tr><td colspan="32" style="text-align:center; color:red;">Aucun agent actif trouvé pour cette salle.</td></tr>`;
        return;
    }
    planningAgentsList = agents;

    const [year, monthNum] = month.split('-');
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    let theadHtml = `<tr><th style="border:1px solid #ddd; padding:5px; background:#1e3a8a; color:white; min-width:150px;">Agent / Date</th>`;
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, monthNum - 1, i);
        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }); 
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const bg = isWeekend ? 'background:#fef3c7; color:#92400e;' : 'background:#1e3a8a; color:white;';
        theadHtml += `<th style="border:1px solid #ddd; padding:5px; ${bg}">${i}<br><small>${dayName}</small></th>`;
    }
    theadHtml += `</tr>`;
    document.getElementById('planning-thead').innerHTML = theadHtml;

    // جلب التخطيط المحفوظ (نستخدم salle كفلتر)
    const { data: savedPlans } = await mySupabase.from('planning').select('*').eq('month_year', month).eq('centre', salle);
    
    currentPlanningData = {};
    if (savedPlans && savedPlans.length > 0) {
        savedPlans.forEach(p => {
            if (!currentPlanningData[p.agent_name]) currentPlanningData[p.agent_name] = {};
            currentPlanningData[p.agent_name][p.day] = p.code;
        });
    }

    const refDate = new Date(2026, 10, 6);
    const getDaysSinceRef = (y, m, d) => Math.floor((new Date(y, m - 1, d) - refDate) / (1000 * 60 * 60 * 24));

    let tbodyHtml = '';
    const isSettat = salle.includes('Settat'); 

    let patrouilleurs = planningAgentsList.filter(a => a.fonction === 'Patrouilleur');
    patrouilleurs.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    if (patrouilleurs.length > 0) {
        tbodyHtml += `<tr><td colspan="${daysInMonth + 1}" style="background:#93c5fd; font-weight:bold; text-align:center; color:#1e3a8a;">Patrouilleurs</td></tr>`;
        let patrouilleurCycle = isSettat ? ['14', '14', '24', '24', '34', '34', 'R', 'R'] : ['15', '16', '25', '26', '35', '36', 'R', 'R'];
        patrouilleurs.forEach((agent, index) => {
            const group = Math.floor(index / 2) % 4; 
            tbodyHtml += `<tr><td style="border:1px solid #ddd; padding:5px; text-align:center; font-weight:bold; background:#f3f4f6;">${agent.nom}</td>`;
            for (let i = 1; i <= daysInMonth; i++) {
                let val = currentPlanningData[agent.nom]?.[i];
                if (!val) {
                    let dayOffset = getDaysSinceRef(parseInt(year), parseInt(monthNum), i);
                    if (isSettat) dayOffset += 6;
                    let cycleIndex = (dayOffset + (group * 2)) % 8;
                    if (cycleIndex < 0) cycleIndex += 8;
                    val = patrouilleurCycle[cycleIndex];
                }
                const date = new Date(year, monthNum - 1, i);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const bg = isWeekend ? 'background:#fffbeb;' : '';
                tbodyHtml += `<td style="border:1px solid #ddd; padding:2px; text-align:center; ${bg}"><input type="text" data-agent="${agent.nom}" data-day="${i}" value="${val || ''}" style="width:100%; border:none; text-align:center; background:transparent; outline:none; font-size:13px; font-weight:${val === 'R' ? 'bold' : 'normal'}; color:${val === 'R' ? 'red' : '#333'};" onchange="mettreAJourPlanning('${agent.nom}', ${i}, this.value)"></td>`;
            }
            tbodyHtml += `</tr>`;
        });
    }

    let standardistes = planningAgentsList.filter(a => a.fonction === 'Standardiste');
    standardistes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    if (standardistes.length > 0) {
        tbodyHtml += `<tr><td colspan="${daysInMonth + 1}" style="background:#93c5fd; font-weight:bold; text-align:center; color:#1e3a8a;">Standardistes</td></tr>`;
        let standardisteCycle = ['OP1', 'OP1', 'OP2', 'OP2', 'OP3', 'OP3', 'R', 'R'];
        standardistes.forEach((agent, index) => {
            const group = index % 4; 
            tbodyHtml += `<tr><td style="border:1px solid #ddd; padding:5px; text-align:right; font-weight:bold; background:#f3f4f6;">${agent.nom}</td>`;
            for (let i = 1; i <= daysInMonth; i++) {
                let val = currentPlanningData[agent.nom]?.[i];
                if (!val) {
                    const dayOffset = getDaysSinceRef(parseInt(year), parseInt(monthNum), i);
                    let cycleIndex = (dayOffset + (group * 2)) % 8;
                    if (cycleIndex < 0) cycleIndex += 8;
                    val = standardisteCycle[cycleIndex];
                }
                const date = new Date(year, monthNum - 1, i);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const bg = isWeekend ? 'background:#fffbeb;' : '';
                tbodyHtml += `<td style="border:1px solid #ddd; padding:2px; text-align:center; ${bg}"><input type="text" data-agent="${agent.nom}" data-day="${i}" value="${val || ''}" style="width:100%; border:none; text-align:center; background:transparent; outline:none; font-size:13px; font-weight:${val === 'R' ? 'bold' : 'normal'}; color:${val === 'R' ? 'red' : '#333'};" onchange="mettreAJourPlanning('${agent.nom}', ${i}, this.value)"></td>`;
            }
            tbodyHtml += `</tr>`;
        });
    }
    document.getElementById('planning-tbody').innerHTML = tbodyHtml;
}

function mettreAJourPlanning(agent, day, code) {
    if (!currentPlanningData[agent]) currentPlanningData[agent] = {};
    currentPlanningData[agent][day] = code.trim();
}

async function sauvegarderPlanning() {
    const month = document.getElementById('planning_month').value;
    const salle = document.getElementById('planning_salle').value;
    if (!month || !salle) return alert('Veuillez choisir un mois et une salle.');

    let insertData = [];
    for (let agent in currentPlanningData) {
        for (let day in currentPlanningData[agent]) {
            insertData.push({ 
                month_year: month, 
                centre: salle, // <--- نحفظ في العمود القديم centre (لأن جدول planning لم يتغير)
                agent_name: agent, 
                day: parseInt(day), 
                code: currentPlanningData[agent][day] 
            });
        }
    }

    // مسح البيانات القديمة لهذا الشهر وهذه الصالة
    await mySupabase.from('planning').delete().eq('month_year', month).eq('centre', salle);

    // إدخال البيانات الجديدة
    if (insertData.length > 0) {
        const { error } = await mySupabase.from('planning').insert(insertData);
        if (error) alert('Erreur: ' + error.message);
        else alert('✅ Planning enregistré !');
    } else alert('✅ Planning vide enregistré.');
}

// ==========================================
// 8. إدارة الخريطة (Suivi sur Carte)
// ==========================================
async function initialiserCarte() {
    document.getElementById('route-1-wrapper').style.display = 'block';
    document.getElementById('route-2-wrapper').style.display = 'block';
    document.getElementById('carte-message').style.display = 'none';

    const { data: points, error } = await mySupabase.from('points_repere').select('*').order('pk');
    if (error || !points || points.length === 0) {
        document.getElementById('carte-route-1').innerHTML = '<p style="color:red; text-align:center;">Aucun point de repère trouvé.</p>';
        return;
    }
    window.allMapPoints = points;
    afficherCarte('Tous');
}

async function afficherCarte(mobile, event) {
    currentCarteMobile = mobile;
    document.querySelectorAll('#param-carte .btn').forEach(b => b.className = 'btn btn-secondary');
    if (event) event.target.className = 'btn btn-blue';

    const wrapper1 = document.getElementById('route-1-wrapper');
    const wrapper2 = document.getElementById('route-2-wrapper');
    const title1 = document.getElementById('route-1-title');
    const title2 = document.getElementById('route-2-title');

    if (mobile === 'Tous') {
        wrapper1.style.display = 'block';
        wrapper2.style.display = 'block';
        title1.textContent = '🛣️ Casablanca ↔ Marrakech (PK 37 000 - 198 000)';
        title2.textContent = '🛣️ Marrakech ↔ Agadir (PK 198 000 - 430 000)';
        dessinerRoute('carte-route-1', 'carte-labels-1', 37000, 198000);
        dessinerRoute('carte-route-2', 'carte-labels-2', 198000, 430000);
        return;
    }

    const circuitName = mobile.replace('Mobile', 'Patrouilleur').trim();
    const { data: circuits, error } = await mySupabase.from('circuits').select('*').eq('nom_circuit', circuitName).not('point_repere_id', 'is', null);
    if (error || !circuits || circuits.length === 0) return alert(`Aucun point configuré pour ${circuitName}.`);

    let pkList = [];
    circuits.forEach(c => {
        const point = window.allMapPoints.find(p => p.id === c.point_repere_id);
        if (point) pkList.push(parseFloat(point.pk));
    });
    if (pkList.length === 0) return alert(`Les points de ${circuitName} sont introuvables.`);

    const minPk = Math.min(...pkList);
    const maxPk = Math.max(...pkList);
    const margin = (maxPk - minPk) * 0.1;
    const finalMinPk = minPk - margin;
    const finalMaxPk = maxPk + margin;

    let route = 2;
    if (finalMaxPk <= 198000) route = 1;
    
    if (route === 1) {
        wrapper1.style.display = 'block';
        wrapper2.style.display = 'none';
        title1.textContent = `🛣️ ${circuitName} (PK ${Math.round(minPk)} - ${Math.round(maxPk)})`;
        dessinerRoute('carte-route-1', 'carte-labels-1', finalMinPk, finalMaxPk);
    } else {
        wrapper1.style.display = 'none';
        wrapper2.style.display = 'block';
        title2.textContent = `🛣️ ${circuitName} (PK ${Math.round(minPk)} - ${Math.round(maxPk)})`;
        dessinerRoute('carte-route-2', 'carte-labels-2', finalMinPk, finalMaxPk);
    }
}

function dessinerRoute(containerId, labelsId, minPk, maxPk) {
    const container = document.getElementById(containerId);
    const labelsContainer = document.getElementById(labelsId);
    let pointsHtml = '', labelsHtml = '';
    if (!window.allMapPoints) return;

    window.allMapPoints.forEach(p => {
        const pkNumber = parseFloat(p.pk);
        if (isNaN(pkNumber) || pkNumber < minPk || pkNumber > maxPk) return;
        const percentage = ((pkNumber - minPk) / (maxPk - minPk)) * 100;
        pointsHtml += `<div style="position:absolute; left:${percentage}%; top:50%; transform:translate(-50%, -50%);"><div style="width:12px; height:12px; background:#3b82f6; border-radius:50%; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.3);" title="${p.libelle} (PK ${p.pk})"></div></div>`;
        labelsHtml += `<div style="position:absolute; left:${percentage}%; top:5px; transform:translateX(-50%); text-align:center; white-space:nowrap;"><div style="font-size:11px; font-weight:bold; color:#1e3a8a;">${p.libelle}</div><div style="font-size:10px; color:#6b7280;">PK ${p.pk}</div></div>`;
    });
    container.innerHTML = pointsHtml;
    labelsContainer.innerHTML = labelsHtml;
}

// ==========================================
// 9. التشغيل الأولي (Initialization)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('postes-list-body')) {
        // 1. تعيين تاريخ اليوم
        const dateInput = document.getElementById('filter_date');
        if (dateInput) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
        }

        // 2. جلب الصالات ثم الورديات
        chargerSalles().then(() => {
            chargerPostes();
        });
    }
});

// --- إدارة الصالات (Salles) ---
// --- إدارة الصالات (Salles) ---

// فتح النافذة (إضافة أو تعديل)
async function ouvrirModalSalle(id = null) {  
    document.getElementById('s_edit_id').value = id || '';
     await chargerOptionsAxes();
    if (id) {
        // إذا كان هناك ID، فهذا يعني أننا نعدل
        document.getElementById('modal-title-salle').textContent = 'Modifier une Salle';
        mySupabase.from('salles').select('*').eq('id', id).single().then(({data}) => {
            if(data) {
                document.getElementById('s_nom').value = data.nom;
                document.getElementById('s_region').value = data.region || '';
            }
        });
    } else {
        document.getElementById('modal-title-salle').textContent = 'Ajouter une Salle';
        document.querySelector('#modal-salle form').reset();
    }
    document.getElementById('modal-salle').style.display = 'flex'; 
}

function fermerModalSalle() { 
    document.getElementById('modal-salle').style.display = 'none'; 
}

// جلب وعرض الصالات
async function chargerSallesListe() {
    const tbody = document.getElementById('salles-list-body');
    if (!tbody) return;
    const { data, error } = await mySupabase.from('salles').select('*').order('nom');
    if (error) return;

    if (data.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Aucune salle.</td></tr>`; 
        return; 
    }

    tbody.innerHTML = data.map(s => `
    <tr>
        <td><strong>${s.nom}</strong></td>
        <td>${s.region || '-'}</td>
        <td>${s.axe || '-'}</td> <!-- الخلية الجديدة هنا -->
        <td>
            <button class="btn btn-blue" onclick="ouvrirModalSalle('${s.id}')" style="padding:5px 10px; background:#3b82f6; margin-right:5px;">✏️</button>
            <button class="btn btn-red" onclick="supprimerSalle('${s.id}')" style="padding:5px 10px;">🗑️</button>
        </td>
    </tr>
`).join('');
}

// حفظ (إضافة أو تعديل)
async function sauvegarderSalle(event) {
    event.preventDefault();
    const id = document.getElementById('s_edit_id').value;
    const nom = document.getElementById('s_nom').value.trim();
    const region = document.getElementById('s_region').value.trim();
    const axe = document.getElementById('s_axe').value;
    const dataToSave = { nom, region, axe }; 
    let error;

    if (id) {
        // تعديل
        const res = await mySupabase.from('salles').update(dataToSave).eq('id', id);
        error = res.error;
    } else {
        // إضافة
        const res = await mySupabase.from('salles').insert([dataToSave]);
        error = res.error;
    }

    if (error) alert("Erreur: " + error.message);
    else { 
        fermerModalSalle(); 
        chargerSallesListe(); 
    }
}

// حذف صالة
async function supprimerSalle(id) {
    if (!confirm('Supprimer cette salle ?')) return;
    await mySupabase.from('salles').delete().eq('id', id);
    chargerSallesListe();
}





// سنضيف دالة لجلب المحاور لملء القوائم، وسنعدل دوال الحفظ والعرض لتشمل المحور

async function chargerOptionsAxes() {
    const { data: axes } = await mySupabase.from('axes').select('*').order('nom');
    if (!axes) return;

    let html = '<option value="">Sélectionnez un Axe</option>';
    axes.forEach(a => html += `<option value="${a.nom}">${a.nom}</option>`);

    if(document.getElementById('s_axe')) document.getElementById('s_axe').innerHTML = html;
    if(document.getElementById('v_axe')) document.getElementById('v_axe').innerHTML = html;
    if(document.getElementById('p_axe')) document.getElementById('p_axe').innerHTML = html;
    if(document.getElementById('pat_axe')) document.getElementById('pat_axe').innerHTML = html;
}