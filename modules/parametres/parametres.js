// --- التنقل الداخلي بين شاشات الإعدادات ---
function ouvrirSousVue(subviewId) {
    document.querySelectorAll('.subview').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(subviewId);
    if (target) target.classList.add('active');

    if (subviewId === 'subview-troncons') chargerTroncons();
    if (subviewId === 'subview-responsables') chargerResponsables();
    if (subviewId === 'subview-projet') {
        chargerListeMarches();
        chargerListeResponsablesPourSelects();
    }
}

// --- إدارة التوقيعات ---
function toggleRemplacant() {
    const div = document.getElementById('div_remplacant');
    div.style.display = (div.style.display === 'none' || div.style.display === '') ? 'flex' : 'none';
}

// --- جلب المسؤولين ---
async function chargerListeResponsablesPourSelects() {
    const { data, error } = await mySupabase.from('responsables').select('*').order('name');
    if (error) return;
    
    const buildOptions = (defaultText) => {
        let html = `<option value="">${defaultText}</option>`;
        data.forEach(r => {
            html += `<option value="${r.name}" data-fonction="${r.fonction}">${r.name} (${r.fonction})</option>`;
        });
        return html;
    };

    const selects = ['sig_dresse_par', 'sig_remplacant', 'p_ing_nom'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = buildOptions('-- Choisir --');
    });
}

// --- إدارة الصفقات ---
async function chargerListeMarches() {
    const select = document.getElementById('select_marche');
    if (!select) return;
    const { data, error } = await mySupabase.from('marches').select('*').order('num');
    if (error) return;
    
    let html = '<option value="">-- Nouveau Marché (Vide) --</option>';
    data.forEach(m => {
        html += `<option value="${m.id}">${m.num} - ${m.nom}</option>`;
    });
    select.innerHTML = html;
}

function nouveauMarche() {
    document.getElementById('form-projet').reset();
    document.getElementById('select_marche').value = '';
    currentMarcheId = null;
    document.getElementById('div_remplacant').style.display = 'none';
}

async function chargerMarcheSelectionne() {
    const id = document.getElementById('select_marche').value;
    if (!id) { nouveauMarche(); return; }

    currentMarcheId = id;
    const { data, error } = await mySupabase.from('marches').select('*').eq('id', id).single();
    if (error || !data) return;

    const d = data.donnees;

    document.getElementById('p_marche_num').value = data.num || '';
    document.getElementById('p_marche_nom').value = data.nom || '';
    document.getElementById('p_maitre_ouvrage').value = d?.general?.maitreOuvrage || '';
    document.getElementById('p_maitre_oeuvre').value = d?.general?.maitreOeuvre || '';
    document.getElementById('p_prestataire').value = d?.general?.prestataire || '';
    document.getElementById('p_entite').value = d?.general?.entite || '';
    document.getElementById('p_date_debut').value = d?.general?.dateDebut || '';
    document.getElementById('p_date_fin').value = d?.general?.dateFin || '';
    document.getElementById('p_objet').value = d?.general?.objet || '';

    document.getElementById('sig_dresse_par').value = d?.signatures?.dresse_par || '';
    document.getElementById('sig_dresse_date').value = d?.signatures?.dresse_date || '';
    document.getElementById('sig_remplacant').value = d?.signatures?.remplacant || '';
    
    if (d?.signatures?.remplacant) {
        document.getElementById('div_remplacant').style.display = 'flex';
    } else {
        document.getElementById('div_remplacant').style.display = 'none';
    }

    document.getElementById('p_ing_nom').value = d?.ingenieurs?.ing_nom || '';
    document.getElementById('p_ing_date').value = d?.ingenieurs?.ing_date || '';
    
    document.getElementById('p_entreprise_nom').value = d?.entreprise?.nom || '';
    document.getElementById('p_entreprise_date').value = d?.entreprise?.date || '';
}

async function sauvegarderProjet(event) {
    event.preventDefault();
    const num = document.getElementById('p_marche_num').value.trim();
    const nom = document.getElementById('p_marche_nom').value.trim();
    if (!num || !nom) return alert('Le N° et le Nom du marché sont obligatoires.');

    const donnees = {
        general: {
            maitreOuvrage: document.getElementById('p_maitre_ouvrage').value,
            maitreOeuvre: document.getElementById('p_maitre_oeuvre').value,
            prestataire: document.getElementById('p_prestataire').value,
            entite: document.getElementById('p_entite').value,
            dateDebut: document.getElementById('p_date_debut').value,
            dateFin: document.getElementById('p_date_fin').value,
            objet: document.getElementById('p_objet').value
        },
        signatures: {
            dresse_par: document.getElementById('sig_dresse_par').value,
            dresse_date: document.getElementById('sig_dresse_date').value,
            remplacant: document.getElementById('sig_remplacant').value
        },
        ingenieurs: {
            ing_nom: document.getElementById('p_ing_nom').value,
            ing_date: document.getElementById('p_ing_date').value
        },
        entreprise: {
            nom: document.getElementById('p_entreprise_nom').value,
            date: document.getElementById('p_entreprise_date').value
        }
    };

    let error;
    if (currentMarcheId) {
        const res = await mySupabase.from('marches').update({ num, nom, donnees }).eq('id', currentMarcheId);
        error = res.error;
    } else {
        const res = await mySupabase.from('marches').insert([{ num, nom, donnees }]);
        error = res.error;
    }

    if (error) alert('Erreur : ' + error.message);
    else {
        alert('✅ Marché enregistré avec succès !');
        chargerListeMarches();
        nouveauMarche();
    }
}

// --- إدارة المقاطع ---
async function chargerTroncons() {
    const tbody = document.getElementById('troncons-body');
    if (!tbody) return;
    const { data, error } = await mySupabase.from('troncons').select('*').order('id');
    if (error) { console.error(error); return; }
    
    tbody.innerHTML = data.map(t => `
        <tr>
            <td><strong>${t.id}</strong></td><td>${t.name}</td><td>${t.pkdebut}</td><td>${t.pkfin}</td>
            <td>
                <button onclick="editerTroncon('${t.id}')" style="background:#3b82f6; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-right:5px;">✏️</button>
                <button class="btn-delete" onclick="supprimerTroncon('${t.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function ajouterTroncon() {
    const id = document.getElementById('t_id').value.trim().toUpperCase();
    const name = document.getElementById('t_name').value.trim();
    const pkdebut = parseFloat(document.getElementById('t_pkd').value);
    const pkfin = parseFloat(document.getElementById('t_pkf').value);
    if (!id || !name || isNaN(pkdebut) || isNaN(pkfin)) return alert('Veuillez remplir tous les champs.');

    const { error } = await mySupabase.from('troncons').insert([{ id, name, pkdebut, pkfin }]);
    if (error) alert('Erreur : ' + error.message);
    else {
        document.getElementById('t_id').value = ''; document.getElementById('t_name').value = '';
        document.getElementById('t_pkd').value = ''; document.getElementById('t_pkf').value = '';
        chargerTroncons();
    }
}

async function supprimerTroncon(id) {
    if (!confirm('Supprimer ce tronçon ?')) return;
    await mySupabase.from('troncons').delete().eq('id', id);
    chargerTroncons();
}

// --- إدارة المسؤولين ---
function toggleAutreFonction(val) {
    const input = document.getElementById('autre_fonction');
    if (val === 'Autres...') { input.style.display = 'block'; input.focus(); } 
    else { input.style.display = 'none'; input.value = ''; }
}

async function chargerResponsables() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    const { data, error } = await mySupabase.from('responsables').select('*').order('id', { ascending: false });
    if (error) { console.error(error); return; }
    
    tbody.innerHTML = data.map(r => `
        <tr>
            <td><strong>${r.name}</strong></td>
            <td>${r.fonction}</td>
            <td style="font-size:12px; color:#666;">${r.troncons ? (typeof r.troncons === 'string' ? JSON.parse(r.troncons).join(', ') : r.troncons.join(', ')) : '-'}</td>
            <td>
                <button onclick="editerResponsable('${r.id}')" style="background:#3b82f6; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-right:5px;">✏️</button>
                <button class="btn-delete" onclick="supprimerResponsable('${r.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function ajouterResponsable() {
    const name = document.getElementById('name').value.trim();
    let fonction = document.getElementById('fonction').value;
    if (fonction === 'Autres...') fonction = document.getElementById('autre_fonction').value.trim();
    if (!name || !fonction) return alert('Veuillez remplir tous les champs.');

    const { error } = await mySupabase.from('responsables').insert([{ name, fonction }]);
    if (error) alert('Erreur : ' + error.message);
    else {
        document.getElementById('name').value = ''; document.getElementById('fonction').value = '';
        document.getElementById('autre_fonction').value = ''; document.getElementById('autre_fonction').style.display = 'none';
        chargerResponsables();
    }
}

async function supprimerResponsable(id) {
    if (!confirm('Supprimer ce responsable ?')) return;
    await mySupabase.from('responsables').delete().eq('id', id);
    chargerResponsables();
}

// --- نافذة التعديل ---
let currentEditType = ''; let currentEditId = ''; let currentMarcheId = null;

function fermerModal() { document.getElementById('edit-modal').style.display = 'none'; }

async function editerTroncon(id) {
    currentEditType = 'troncon'; currentEditId = id;
    const { data } = await mySupabase.from('troncons').select('*').eq('id', id).single();
    document.getElementById('modal-title').textContent = 'Modifier Tronçon';
    document.getElementById('modal-body').innerHTML = `
        <input type="text" id="edit_t_name" value="${data.name}" style="width:100%; padding:8px; margin-bottom:10px;" placeholder="Nom">
        <input type="number" id="edit_t_pkd" value="${data.pkdebut}" style="width:100%; padding:8px; margin-bottom:10px;" placeholder="PK Début">
        <input type="number" id="edit_t_pkf" value="${data.pkfin}" style="width:100%; padding:8px; margin-bottom:10px;" placeholder="PK Fin">
    `;
    document.getElementById('edit-modal').style.display = 'flex';
}

async function editerResponsable(id) {
    currentEditType = 'responsable'; currentEditId = id;
    const { data } = await mySupabase.from('responsables').select('*').eq('id', id).single();
    const { data: tronconsData } = await mySupabase.from('troncons').select('*').order('id');
    const tousLesTroncons = tronconsData || [];

    let tronconsHtml = '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">';
    if (tousLesTroncons.length === 0) {
        tronconsHtml += '<p style="color:red; font-size:12px;">Aucun tronçon trouvé.</p>';
    } else {
        tousLesTroncons.forEach(t => {
            const isChecked = (data.troncons && data.troncons.includes(t.id)) ? 'checked' : '';
            tronconsHtml += `
                <label style="display:flex; align-items:center; gap:5px; background:#f0f0f0; padding:5px 10px; border-radius:5px; cursor:pointer;">
                    <input type="checkbox" class="edit_troncon_cb" value="${t.id}" ${isChecked}> ${t.id} (${t.name})
                </label>
            `;
        });
    }
    tronconsHtml += '</div>';

    document.getElementById('modal-title').textContent = 'Modifier Responsable';
    document.getElementById('modal-body').innerHTML = `
        <label>Nom</label><input type="text" id="edit_r_name" value="${data.name}" style="width:100%; padding:8px; margin-bottom:10px;">
        <label>Fonction</label><input type="text" id="edit_r_fonction" value="${data.fonction}" style="width:100%; padding:8px; margin-bottom:10px;">
        <label style="font-weight:bold; margin-top:10px; display:block;">Tronçons attribués :</label>${tronconsHtml}
    `;
    document.getElementById('edit-modal').style.display = 'flex';
}

async function sauvegarderModification() {
    if (currentEditType === 'troncon') {
        const name = document.getElementById('edit_t_name').value;
        const pkdebut = parseFloat(document.getElementById('edit_t_pkd').value);
        const pkfin = parseFloat(document.getElementById('edit_t_pkf').value);
        await mySupabase.from('troncons').update({ name, pkdebut, pkfin }).eq('id', currentEditId);
        chargerTroncons();
    } else if (currentEditType === 'responsable') {
        const name = document.getElementById('edit_r_name').value;
        const fonction = document.getElementById('edit_r_fonction').value;
        const selectedTroncons = [];
        document.querySelectorAll('.edit_troncon_cb:checked').forEach(cb => selectedTroncons.push(cb.value));
        await mySupabase.from('responsables').update({ name, fonction, troncons: JSON.stringify(selectedTroncons) }).eq('id', currentEditId);
        chargerResponsables();
    }
    fermerModal();
}