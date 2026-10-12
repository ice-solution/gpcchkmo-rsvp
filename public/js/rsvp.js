(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const STEP_LABELS = ['簡介', '隊伍', '隊長', '隊友', '競賽', '意向', '選手包', '條款'];
  let meta = null;
  let step = 0;
  let maxReached = 0;
  const total = 8;

  const DRAFT_KEY = 'gpcchkmo.rsvp.draft.v2';
  let saveTimer = null;
  let restoring = false;

  const TEXT_IDS = [
    'captainClub',
    'captainClubOther',
    'captainClubSource',
    'captainEmail',
    'displayName',
    'captainChineseName',
    'captainEnglishName',
    'captainDob',
    'captainWhatsapp',
    'captainEmergencyName',
    'captainEmergencyPhone',
    'teammateChineseName',
    'teammateEnglishName',
    'teammateDob',
    'teammateWhatsapp',
    'teammateEmail',
    'teammateClub',
    'teammateEmergencyName',
    'teammateEmergencyPhone',
    'preferredVenueId',
    'spectatorCount',
  ];
  const CHECK_IDS = [
    'introAck',
    'agreeRules',
    'agreeRanking',
    'agreeTruth',
    'agreePics',
    'agreeMarketing',
    'agreeScheduleTerms',
  ];
  const RADIO_NAMES = [
    'captainGender',
    'teammateGender',
    'ageGroup',
    'eventCategory',
    'carnivalIntent',
    'skillLevel',
    'packTier',
  ];
  const MULTI_CHECK_NAMES = ['interests', 'contactPrefs', 'hearAbout'];

  function setRadio(name, value) {
    if (!value) return;
    const el = $$(`input[name="${name}"]`).find((n) => n.value === value);
    if (el) el.checked = true;
  }

  function setMultiChecks(name, values) {
    const set = new Set(values || []);
    $$(`input[name="${name}"]`).forEach((el) => {
      el.checked = set.has(el.value);
    });
  }

  function collectDraft() {
    const text = {};
    TEXT_IDS.forEach((id) => {
      const el = $(`#${id}`);
      if (el) text[id] = el.value;
    });
    const checks = {};
    CHECK_IDS.forEach((id) => {
      const el = $(`#${id}`);
      if (el) checks[id] = el.checked;
    });
    const radios = {};
    RADIO_NAMES.forEach((name) => {
      radios[name] = radioValue(name);
    });
    const multi = {};
    MULTI_CHECK_NAMES.forEach((name) => {
      multi[name] = checkedValues(name);
    });
    return { step, text, checks, radios, multi, savedAt: Date.now() };
  }

  function saveDraft() {
    if (restoring) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
    } catch (err) {
      console.warn('save draft failed', err);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 200);
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  async function restoreDraft(draft) {
    if (!draft) return;
    restoring = true;
    try {
      Object.entries(draft.text || {}).forEach(([id, value]) => {
        const el = $(`#${id}`);
        if (el && value != null) el.value = value;
      });
      Object.entries(draft.checks || {}).forEach(([id, value]) => {
        const el = $(`#${id}`);
        if (el) el.checked = Boolean(value);
      });
      Object.entries(draft.radios || {}).forEach(([name, value]) => {
        if (name === 'ageGroup' || name === 'eventCategory') return;
        setRadio(name, value);
      });
      Object.entries(draft.multi || {}).forEach(([name, values]) => {
        setMultiChecks(name, values);
      });

      const clubSelect = $('#captainClub');
      if (clubSelect) clubSelect.dispatchEvent(new Event('change'));
      document.dispatchEvent(new Event('change'));

      await refreshEligibility();
      setRadio('ageGroup', draft.radios && draft.radios.ageGroup);
      setRadio('eventCategory', draft.radios && draft.radios.eventCategory);
      syncQualifierAndScheduleTerms();

      const savedStep = Number(draft.step);
      if (Number.isFinite(savedStep) && savedStep >= 0 && savedStep < total) {
        step = savedStep;
        maxReached = Math.max(maxReached, step);
      }
    } finally {
      restoring = false;
    }
  }

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
          const canJump = i <= maxReached || i === step + 1;
          const disabled = canJump ? '' : 'disabled';
          const current = i === step ? 'aria-current="step"' : '';
          return `<li class="flex items-center gap-2">
            <button type="button" class="step-jump" data-goto="${i}" ${disabled} ${current} aria-label="前往步驟 ${i + 1} ${label}">
              <span class="step-dot ${cls}">${i + 1}</span>
              <span class="hidden text-xs font-medium text-slate-600 sm:inline">${label}</span>
            </button>
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

  async function goToStep(target) {
    target = Number(target);
    if (!Number.isFinite(target) || target < 0 || target >= total || target === step) return;
    if (target > maxReached + 1) return;

    if (target > step) {
      for (let n = step; n < target; n += 1) {
        const errors = validateStep(n);
        if (errors.length) {
          showAlert(errors);
          if (n !== step) {
            step = n;
            maxReached = Math.max(maxReached, step);
            if (step === 4) await refreshEligibility();
            renderStepper();
            saveDraft();
          }
          return;
        }
      }
    }

    showAlert([]);
    if (step === 3 && target >= 4) await refreshEligibility();
    step = target;
    maxReached = Math.max(maxReached, step);
    if (step === 4) await refreshEligibility();
    renderStepper();
    saveDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    syncQualifierAndScheduleTerms();
  }

  function validateStep(n) {
    const errors = [];
    if (n === 0) {
      if (!$('#introAck').checked) {
        errors.push('請先閱讀簡介及賽事資訊，並勾選確認後才可開始填寫報名表');
      }
    }
    if (n === 1) {
      if (!$('#captainClub').value.trim()) errors.push('請選擇賽事報名邀請球會');
      {
        const clubVal = $('#captainClub').value;
        const followups = (meta && meta.captainClubFollowups) || {};
        const fu = followups[clubVal];
        if (
          (clubVal === '__other__' || (fu && fu.kind === 'name' && fu.required)) &&
          !$('#captainClubOther').value.trim()
        ) {
          errors.push('請填寫球會／機構名稱');
        }
      }
      if (!$('#captainEmail').value.trim()) errors.push('請填寫隊長電郵');
      if (!$('#displayName').value.trim()) errors.push('請填寫隊伍／組名');
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
      if (!$('#agreeScheduleTerms').checked) {
        errors.push('請閱讀並同意《賽程管理與特別說明》');
      }
    }
    if (n === 5) {
      if (!radioValue('carnivalIntent')) errors.push('請選擇嘉年華出席意向');
      if (!radioValue('skillLevel')) errors.push('請選擇技術程度');
      if (checkedValues('interests').length < 1) {
        errors.push('請至少選擇一項感興趣的 GPCC 活動或內容');
      }
      if (checkedValues('hearAbout').length < 1) {
        errors.push('請至少選擇一個得知渠道');
      }
    }
    if (n === 6) {
      if (!radioValue('packTier')) errors.push('請選擇選手包加購選項');
    }
    if (n === 7) {
      ['agreeRules', 'agreeRanking', 'agreeTruth', 'agreePics'].forEach((id) => {
        if (!$(`#${id}`).checked) errors.push('請勾選所有必填聲明');
      });
    }
    return [...new Set(errors)];
  }

  function buildPayload() {
    const venueSelect = $('#preferredVenueId');
    const venueOption = venueSelect.selectedOptions[0];
    const clubSelect = $('#captainClub').value.trim();
    const followups = (meta && meta.captainClubFollowups) || {};
    const clubFollowup = followups[clubSelect];
    const packTier = radioValue('packTier') || 'standard';
    return {
      introAcknowledged: $('#introAck').checked,
      packTier,
      wantPlayerPack: packTier !== 'standard',
      captainClub: clubSelect,
      captainClubOther:
        clubSelect === '__other__' || (clubFollowup && clubFollowup.kind === 'name')
          ? $('#captainClubOther').value.trim()
          : '',
      captainClubSource:
        clubFollowup && clubFollowup.kind === 'source'
          ? $('#captainClubSource').value.trim()
          : '',
      registrationType: 'first_or_only',
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
      qualifierSlotLabel: ($('#qualifierSlotText')?.textContent || '').trim(),
      availability: [],
      research: {
        carnivalIntent: radioValue('carnivalIntent'),
        spectatorCount: $('#spectatorCount').value,
        skillLevel: radioValue('skillLevel'),
        interests: checkedValues('interests'),
        hearAbout: checkedValues('hearAbout'),
        contactPrefs: checkedValues('contactPrefs'),
      },
      agreements: {
        rules: $('#agreeRules').checked,
        ranking: $('#agreeRanking').checked,
        truthfulness: $('#agreeTruth').checked,
        pics: $('#agreePics').checked,
        marketing: $('#agreeMarketing').checked,
        scheduleTerms: $('#agreeScheduleTerms').checked,
      },
    };
  }

  function setupDobInputs(bounds) {
    const dob =
      bounds && bounds.min && bounds.max
        ? bounds
        : { min: '1961-01-01', max: '2008-12-31', mid: '1984-07-01' };
    ['captainDob', 'teammateDob'].forEach((id) => {
      const el = $(`#${id}`);
      if (!el) return;
      el.min = dob.min;
      el.max = dob.max;
      el.addEventListener('focus', () => {
        if (!el.value) {
          el.value = dob.mid;
          el.dataset.dobProbe = dob.mid;
        }
      });
      el.addEventListener('change', () => {
        delete el.dataset.dobProbe;
      });
      el.addEventListener('blur', () => {
        if (el.dataset.dobProbe && el.value === el.dataset.dobProbe) {
          el.value = '';
          delete el.dataset.dobProbe;
        }
      });
    });
  }

  function selectedVenueMeta() {
    const id = $('#preferredVenueId')?.value;
    if (!id || !meta?.venues) return null;
    return meta.venues.find((v) => v.id === id) || null;
  }

  function formatQualifierSlot(slot) {
    if (!slot) return '';
    const category = [slot.ageShort, slot.eventShort].filter(Boolean).join(' ');
    return category ? `${slot.date} ${slot.time}｜${category}` : `${slot.date} ${slot.time}`;
  }

  function resolveClientQualifierSlot() {
    const venue = selectedVenueMeta();
    if (!venue) return null;
    const key = venue.scheduleKey || '';
    const ageGroup = radioValue('ageGroup');
    const eventCategory = radioValue('eventCategory');
    const schedules = meta.qualifierSchedules || {};

    if (key === 'lit_pickle') {
      if (!eventCategory) {
        return { key, text: '', hint: '請先選擇競賽項目，以顯示預計海選時間。' };
      }
      const slot = (schedules.litPickle || {})[eventCategory];
      return {
        key,
        text: formatQualifierSlot(slot),
        hint: slot ? '' : '未能對應此競賽項目的海選時間，請聯絡大會確認。',
      };
    }

    if (key === 'mypw') {
      if (!ageGroup || !eventCategory) {
        return {
          key,
          text: '',
          hint: '請先選擇年齡組別及競賽項目，以顯示預計海選時間。',
        };
      }
      const slot = (schedules.mypw || {})[`${ageGroup}|${eventCategory}`];
      return {
        key,
        text: formatQualifierSlot(slot),
        hint: slot ? '' : '未能對應此年齡組別／競賽項目的海選時間，請聯絡大會確認。',
      };
    }

    return null;
  }

  function syncQualifierAndScheduleTerms() {
    const venue = selectedVenueMeta();
    const termsPanel = $('#scheduleTermsPanel');
    const termsBody = $('#scheduleTermsBody');
    const slotPanel = $('#qualifierSlotPanel');
    const slotText = $('#qualifierSlotText');
    const slotHint = $('#qualifierSlotHint');
    const agree = $('#agreeScheduleTerms');

    if (termsPanel && termsBody && meta?.qualifierSchedules?.notice) {
      const notice = meta.qualifierSchedules.notice;
      termsBody.innerHTML = (notice.body || [])
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('');
    }

    if (!venue) {
      termsPanel?.classList.add('hidden');
      slotPanel?.classList.add('hidden');
      if (agree) agree.required = false;
      return;
    }

    termsPanel?.classList.remove('hidden');
    if (agree) agree.required = true;

    const resolved = resolveClientQualifierSlot();
    if (!resolved) {
      slotPanel?.classList.add('hidden');
      if (slotText) slotText.textContent = '';
      if (slotHint) {
        slotHint.textContent = '';
        slotHint.classList.add('hidden');
      }
      return;
    }

    slotPanel?.classList.remove('hidden');
    if (slotText) slotText.textContent = resolved.text || '';
    if (slotHint) {
      if (resolved.hint) {
        slotHint.textContent = resolved.hint;
        slotHint.classList.remove('hidden');
      } else {
        slotHint.textContent = '';
        slotHint.classList.add('hidden');
      }
    }
  }

  async function initMeta() {
    const res = await fetch('/api/meta');
    const json = await res.json();
    if (!json.ok) throw new Error('無法載入表單設定');
    meta = json.data;

    const captainClubSelect = $('#captainClub');
    captainClubSelect.innerHTML =
      '<option value="">請選擇</option>' +
      (meta.captainClubs || [])
        .map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`)
        .join('');

    function syncCaptainClubFollowups() {
      const value = captainClubSelect.value;
      const followups = meta.captainClubFollowups || {};
      const fu =
        value === '__other__'
          ? {
              kind: 'name',
              required: true,
              label: '請填寫球會／機構名稱 *',
              placeholder: '請輸入球會或機構名稱',
            }
          : followups[value];
      const nameWrap = $('#captainClubOtherWrap');
      const nameInput = $('#captainClubOther');
      const nameLabel = $('#captainClubOtherLabel');
      const sourceWrap = $('#captainClubSourceWrap');
      const sourceInput = $('#captainClubSource');

      const showName = Boolean(fu && fu.kind === 'name');
      const showSource = Boolean(fu && fu.kind === 'source');

      nameWrap?.classList.toggle('hidden', !showName);
      sourceWrap?.classList.toggle('hidden', !showSource);

      if (nameInput) {
        nameInput.required = showName && Boolean(fu?.required);
        if (showName) {
          if (fu.label && nameLabel) nameLabel.textContent = fu.label;
          if (fu.placeholder) nameInput.placeholder = fu.placeholder;
        } else {
          nameInput.value = '';
        }
      }
      if (sourceInput) {
        sourceInput.required = false;
        if (!showSource) sourceInput.value = '';
      }
    }
    captainClubSelect.addEventListener('change', syncCaptainClubFollowups);
    syncCaptainClubFollowups();

    function roundMoney(n) {
      return Math.round(Number(n) * 100) / 100;
    }
    function syncPackFee() {
      const tier = radioValue('packTier') || 'standard';
      const tierMeta = (meta.packTiers || []).find((t) => t.value === tier);
      const entry = Number(meta.fee.entryFeeHkd || meta.fee.baseAmountHkd || 680);
      const pack = tierMeta
        ? Number(tierMeta.addonHkd || 0)
        : tier === 'premium'
          ? Number(meta.fee.premiumPackHkd || 760)
          : tier === 'essential'
            ? Number(meta.fee.essentialPackHkd || meta.fee.playerPackPriceHkd || 200)
            : 0;
      const rateRaw = meta.fee && meta.fee.feeRate;
      const rate = Number.isFinite(Number(rateRaw)) ? Number(rateRaw) : 0;
      const subtotal = roundMoney(entry + pack);
      const surcharge = roundMoney(subtotal * rate);
      const total = roundMoney(subtotal + surcharge);
      $$('#pack-line').forEach((el) => el.classList.toggle('hidden', pack <= 0));
      $$('#pack-addon-display').forEach((el) => {
        el.textContent = String(pack);
      });
      const sEl = $('#fee-surcharge-display');
      const tEl = $('#fee-total-display');
      if (sEl) sEl.textContent = String(surcharge);
      if (tEl) tEl.textContent = String(total);
    }
    document.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'packTier') syncPackFee();
    });
    syncPackFee();

    setupDobInputs(meta.dobBounds);

    radioCards($('#carnivalIntentOptions'), 'carnivalIntent', meta.carnivalIntent);
    radioCards($('#skillLevelOptions'), 'skillLevel', meta.skillLevels);
    checkCards($('#interestOptions'), 'interests', meta.interestTopics);
    checkCards($('#hearAboutOptions'), 'hearAbout', meta.hearAbout);
    checkCards($('#contactPrefOptions'), 'contactPrefs', meta.contactPrefs);

    const venue = $('#preferredVenueId');
    venue.innerHTML =
      '<option value="">請選擇</option>' +
      meta.venues
        .map((v) => {
          const text = v.label || v.name || '';
          return `<option value="${v.id}" data-schedule-key="${escapeHtml(v.scheduleKey || '')}">${escapeHtml(text)}</option>`;
        })
        .join('');
    venue.addEventListener('change', syncQualifierAndScheduleTerms);

    const spectators = $('#spectatorCount');
    spectators.innerHTML =
      '<option value="">未能確定／不填</option>' +
      meta.spectatorCounts
        .map((v) => `<option value="${v.value}">${escapeHtml(v.label)}</option>`)
        .join('');

    syncQualifierAndScheduleTerms();
  }

  async function boot() {
    await initMeta();
    const draft = readDraft();
    if (draft) await restoreDraft(draft);
    renderStepper();

    $('#rsvp-form').addEventListener('input', scheduleSave);
    $('#rsvp-form').addEventListener('change', scheduleSave);

    $('#stepper').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-goto]');
      if (!btn || btn.disabled) return;
      goToStep(btn.dataset.goto);
    });

    $('#btn-prev').addEventListener('click', () => {
      goToStep(step - 1);
    });

    $('#btn-next').addEventListener('click', () => {
      goToStep(step + 1);
    });

    ['captainDob', 'teammateDob'].forEach((id) => {
      $(`#${id}`).addEventListener('change', () => {
        if (step >= 4) refreshEligibility();
      });
    });
    document.addEventListener('change', (e) => {
      if (!e.target) return;
      if (
        (e.target.name === 'captainGender' || e.target.name === 'teammateGender') &&
        step >= 4
      ) {
        refreshEligibility();
      }
      if (e.target.name === 'ageGroup' || e.target.name === 'eventCategory') {
        syncQualifierAndScheduleTerms();
      }
    });

    $('#rsvp-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errors = validateStep(7);
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
        const gatewayOn = Boolean(meta && meta.paymentGatewayEnabled);
        clearDraft();
        window.location.href = `/rsvp/success?id=${encodeURIComponent(id)}${
          gatewayOn ? '&pay=1' : ''
        }`;
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
