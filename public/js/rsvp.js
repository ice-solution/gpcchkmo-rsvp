(() => {
  const STEP_LABELS = ['簡介', '隊伍', '隊長', '隊友', '競賽', '意向', '條款'];
  let meta = null;
  let step = 0;
  const total = 7;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  function showAlert(messages) {
    const el = $('#form-alert');
    if (!messages || !messages.length) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = messages.map((m) => `<div>${escapeHtml(m)}</div>`).join('');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function radioCards(container, name, options, required = true) {
    container.innerHTML = options
      .map(
        (opt) => `
      <label class="choice-card">
        <input type="radio" name="${name}" value="${opt.value}" ${required ? 'required' : ''} />
        <span>${escapeHtml(opt.label)}</span>
      </label>`
      )
      .join('');
  }

  function checkCards(container, name, options) {
    container.innerHTML = options
      .map(
        (opt) => `
      <label class="choice-card">
        <input type="checkbox" name="${name}" value="${opt.value}" />
        <span>${escapeHtml(opt.label)}</span>
      </label>`
      )
      .join('');
  }

  function renderStepper() {
    const root = $('#stepper');
    root.innerHTML = `
      <ol class="flex flex-wrap items-center justify-between gap-2">
        ${STEP_LABELS.map((label, i) => {
          const cls =
            i === step ? 'step-dot-active' : i < step ? 'step-dot-done' : 'step-dot-idle';
          return `<li class="flex items-center gap-2">
            <span class="step-dot ${cls}">${i + 1}</span>
            <span class="hidden text-xs font-medium text-slate-600 sm:inline">${label}</span>
          </li>`;
        }).join('<li class="hidden h-px flex-1 bg-slate-200 sm:block" aria-hidden="true"></li>')}
      </ol>`;
    $('#step-caption').textContent = `步驟 ${step + 1} / ${total}`;
    $('#btn-prev').disabled = step === 0;
    $('#btn-next').classList.toggle('hidden', step === total - 1);
    $('#btn-submit').classList.toggle('hidden', step !== total - 1);
    $('#btn-next').textContent = step === 0 ? '開始填寫報名表' : '下一步';
    $$('.step-panel').forEach((panel) => {
      panel.classList.toggle('hidden', Number(panel.dataset.step) !== step);
    });
  }

  function checkedValues(name) {
    return $$(`input[name="${name}"]:checked`).map((el) => el.value);
  }

  function radioValue(name) {
    const el = $(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  async function refreshEligibility() {
    const captainDob = $('#captainDob').value;
    const teammateDob = $('#teammateDob').value;
    const captainGender = radioValue('captainGender');
    const teammateGender = radioValue('teammateGender');

    const ageBox = $('#ageGroupOptions');
    const eventBox = $('#eventCategoryOptions');
    const ageHint = $('#ageGroupHint');
    const eventHint = $('#eventCategoryHint');

    if (!captainDob || !teammateDob || !captainGender || !teammateGender) {
      ageBox.innerHTML = '<p class="text-sm text-slate-500">請先完成隊長與隊友的出生日期及性別。</p>';
      eventBox.innerHTML = '<p class="text-sm text-slate-500">請先完成隊長與隊友的性別。</p>';
      return;
    }

    const qs = new URLSearchParams({
      captainDob,
      teammateDob,
      captainGender,
      teammateGender,
    });
    const res = await fetch(`/api/meta/eligibility?${qs}`);
    const json = await res.json();
    const { ageGroups, eventCategories } = json.data;

    if (!ageGroups.length) {
      ageBox.innerHTML = '';
      ageHint.textContent = '兩位球員年齡組合未符合任何年齡組別（須介乎 18–65，並同時符合所選組別）。';
      ageHint.classList.remove('hidden');
    } else {
      ageHint.classList.add('hidden');
      radioCards(ageBox, 'ageGroup', ageGroups);
    }

    if (!eventCategories.length) {
      eventBox.innerHTML = '';
      eventHint.textContent = '性別組合未能對應可用競賽項目。';
      eventHint.classList.remove('hidden');
    } else {
      eventHint.classList.add('hidden');
      radioCards(eventBox, 'eventCategory', eventCategories);
    }
  }

  function validateStep(n) {
    const errors = [];
    if (n === 0) {
      if (!$('#introAck').checked) {
        errors.push('請先閱讀簡介及賽事資訊，並勾選確認後才可開始填寫報名表');
      }
    }
    if (n === 1) {
      if (!$('#captainClub').value.trim()) errors.push('請填寫隊長所屬球會／機構');
      if (!radioValue('registrationType')) errors.push('請選擇報名類型');
      if (!$('#captainEmail').value.trim()) errors.push('請填寫隊長電郵');
    }
    if (n === 2) {
      ['captainChineseName', 'captainEnglishName', 'captainDob', 'captainWhatsapp', 'captainEmergencyName', 'captainEmergencyPhone'].forEach(
        (id) => {
          if (!$(`#${id}`).value.trim()) errors.push('請完整填寫隊長資料');
        }
      );
      if (!radioValue('captainGender')) errors.push('請選擇隊長性別');
    }
    if (n === 3) {
      ['teammateChineseName', 'teammateEnglishName', 'teammateDob', 'teammateWhatsapp', 'teammateEmail', 'teammateEmergencyName', 'teammateEmergencyPhone'].forEach(
        (id) => {
          if (!$(`#${id}`).value.trim()) errors.push('請完整填寫隊友資料');
        }
      );
      if (!radioValue('teammateGender')) errors.push('請選擇隊友性別');
    }
    if (n === 4) {
      if (!radioValue('ageGroup')) errors.push('請選擇年齡組別');
      if (!radioValue('eventCategory')) errors.push('請選擇競賽項目');
      if (!$('#preferredVenueId').value) errors.push('請選擇首選海選地區／球館');
      if (!checkedValues('availability').length) errors.push('請至少選擇一個可參賽時段');
    }
    if (n === 5) {
      if (!radioValue('carnivalIntent')) errors.push('請選擇嘉年華出席意向');
      if (!radioValue('skillLevel')) errors.push('請選擇技術程度');
      if (!checkedValues('interests').length) errors.push('請至少選擇一項感興趣內容');
      if (!radioValue('hearAbout')) errors.push('請選擇得知渠道');
    }
    if (n === 6) {
      ['agreeRules', 'agreeRanking', 'agreeTruth', 'agreePics'].forEach((id) => {
        if (!$(`#${id}`).checked) errors.push('請勾選所有必填聲明');
      });
    }
    return [...new Set(errors)];
  }

  function buildPayload() {
    const venueSelect = $('#preferredVenueId');
    const venueOption = venueSelect.selectedOptions[0];
    return {
      introAcknowledged: $('#introAck').checked,
      captainClub: $('#captainClub').value.trim(),
      registrationType: radioValue('registrationType'),
      captainEmail: $('#captainEmail').value.trim(),
      displayName: $('#displayName').value.trim(),
      captain: {
        chineseName: $('#captainChineseName').value.trim(),
        englishName: $('#captainEnglishName').value.trim(),
        gender: radioValue('captainGender'),
        dateOfBirth: $('#captainDob').value,
        whatsapp: $('#captainWhatsapp').value.trim(),
        emergencyContact: {
          name: $('#captainEmergencyName').value.trim(),
          phone: $('#captainEmergencyPhone').value.trim(),
        },
      },
      teammate: {
        chineseName: $('#teammateChineseName').value.trim(),
        englishName: $('#teammateEnglishName').value.trim(),
        gender: radioValue('teammateGender'),
        dateOfBirth: $('#teammateDob').value,
        whatsapp: $('#teammateWhatsapp').value.trim(),
        email: $('#teammateEmail').value.trim(),
        club: $('#teammateClub').value.trim(),
        emergencyContact: {
          name: $('#teammateEmergencyName').value.trim(),
          phone: $('#teammateEmergencyPhone').value.trim(),
        },
      },
      ageGroup: radioValue('ageGroup'),
      eventCategory: radioValue('eventCategory'),
      preferredVenueId: venueSelect.value,
      preferredVenueLabel: venueOption ? venueOption.textContent : '',
      availability: checkedValues('availability'),
      research: {
        carnivalIntent: radioValue('carnivalIntent'),
        spectatorCount: $('#spectatorCount').value,
        skillLevel: radioValue('skillLevel'),
        interests: checkedValues('interests'),
        hearAbout: radioValue('hearAbout'),
        contactPrefs: checkedValues('contactPrefs'),
      },
      agreements: {
        rules: $('#agreeRules').checked,
        ranking: $('#agreeRanking').checked,
        truthfulness: $('#agreeTruth').checked,
        pics: $('#agreePics').checked,
        marketing: $('#agreeMarketing').checked,
      },
    };
  }

  async function initMeta() {
    const res = await fetch('/api/meta');
    const json = await res.json();
    if (!json.ok) throw new Error('無法載入表單設定');
    meta = json.data;

    radioCards($('#registrationTypeOptions'), 'registrationType', meta.registrationTypes);
    checkCards($('#availabilityOptions'), 'availability', meta.availabilitySlots);
    radioCards($('#carnivalIntentOptions'), 'carnivalIntent', meta.carnivalIntent);
    radioCards($('#skillLevelOptions'), 'skillLevel', meta.skillLevels);
    checkCards($('#interestOptions'), 'interests', meta.interestTopics);
    radioCards($('#hearAboutOptions'), 'hearAbout', meta.hearAbout);
    checkCards($('#contactPrefOptions'), 'contactPrefs', meta.contactPrefs);

    const venue = $('#preferredVenueId');
    venue.innerHTML =
      '<option value="">請選擇</option>' +
      meta.venues
        .map((v) => `<option value="${v.id}">${escapeHtml(v.label)}</option>`)
        .join('');

    const spectators = $('#spectatorCount');
    spectators.innerHTML =
      '<option value="">未能確定／不填</option>' +
      meta.spectatorCounts
        .map((v) => `<option value="${v.value}">${escapeHtml(v.label)}</option>`)
        .join('');
  }

  async function boot() {
    await initMeta();
    renderStepper();

    $('#btn-prev').addEventListener('click', () => {
      if (step > 0) {
        step -= 1;
        showAlert([]);
        renderStepper();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    $('#btn-next').addEventListener('click', async () => {
      const errors = validateStep(step);
      if (errors.length) {
        showAlert(errors);
        return;
      }
      showAlert([]);
      if (step === 3) await refreshEligibility();
      step += 1;
      if (step === 4) await refreshEligibility();
      renderStepper();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    ['captainDob', 'teammateDob'].forEach((id) => {
      $(`#${id}`).addEventListener('change', () => {
        if (step >= 4) refreshEligibility();
      });
    });
    document.addEventListener('change', (e) => {
      if (
        e.target &&
        (e.target.name === 'captainGender' || e.target.name === 'teammateGender') &&
        step >= 4
      ) {
        refreshEligibility();
      }
    });

    $('#rsvp-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errors = validateStep(6);
      if (errors.length) {
        showAlert(errors);
        return;
      }
      if (!$('#introAck').checked) {
        showAlert(['請先於簡介頁勾選確認']);
        step = 0;
        renderStepper();
        return;
      }
      const btn = $('#btn-submit');
      btn.disabled = true;
      btn.textContent = '提交中…';
      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        });
        const json = await res.json();
        if (!json.ok) {
          showAlert(json.errors || ['提交失敗']);
          btn.disabled = false;
          btn.textContent = '提交報名申請';
          return;
        }
        const id = json.data.applicationId;
        window.location.href = `/rsvp/success?id=${encodeURIComponent(id)}`;
      } catch (err) {
        console.error(err);
        showAlert(['網絡錯誤，請稍後再試']);
        btn.disabled = false;
        btn.textContent = '提交報名申請';
      }
    });
  }

  boot().catch((err) => {
    console.error(err);
    showAlert(['無法初始化報名表，請重新整理頁面']);
  });
})();
