'use strict';

/* =========================================
   1. CONFIGURATION & CONSTANTS
   ========================================= */
const CONFIG = {
  scroll: { threshold: 50, throttleMs: 100 },
  animation: { duration: 2000, threshold: 0.1 },
  roi: { maxHours: 168, hourlyRate: 200, weeks: 4, baseImpact: 150, benefitFactor: 0.7 },
  storageKeys: { quiz: 'adpsike_quiz_data', breathingMode: 'adpsike_breathing_mode' }
};


/* =========================================
   2. CORE UTILITIES (DOM, STORAGE)
   ========================================= */

const DOM = {
  get: (id) => document.getElementById(id),
  getAll: (selector) => document.querySelectorAll(selector),
  addClass: (el, cls) => el?.classList.add(cls),
  removeClass: (el, cls) => el?.classList.remove(cls),
  toggleClass: (el, cls) => el?.classList.toggle(cls),
  hasClass: (el, cls) => el?.classList.contains(cls),
  setAttr: (el, attr, val) => el?.setAttribute(attr, val),
  getAttr: (el, attr) => el?.getAttribute(attr),
  setStyle: (el, styles) => Object.assign(el?.style || {}, styles),
  setText: (el, text) => { if (el) el.textContent = text; },
  clear: (el) => { if (el) el.textContent = ''; },
  hideAll: (selector) => document.querySelectorAll(selector).forEach(el => el.classList.remove('active')),
  
  create: (tag, { className, text, style, attrs, children } = {}) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    if (style) Object.assign(el.style, style);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (children && Array.isArray(children)) {
      children.forEach(child => child && el.appendChild(child));
    }
    return el;
  }
};

const Storage = {
  get(key) {
    try {
      const val = localStorage.getItem(key);
      try { return JSON.parse(val); } catch (e) { return val; }
    } catch (e) {
      console.warn('Storage inaccesible:', e);
      return null;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val);
    } catch (e) {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

const Validators = {
  number: (val, min, max, defaultVal = 0) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return defaultVal;
    return Math.min(Math.max(parsed, min), max);
  },
  
  safeId: (id) => {
    return /^[a-zA-Z0-9-_]+$/.test(id) ? id : null;
  }
};


/* =========================================
   3. UI & INTERACTION MODULES
   ========================================= */

const Accessibility = {
  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) Modals.close(activeModal);

        const activeEmotion = DOM.get('emotion-card-overlay');
        if (activeEmotion && DOM.hasClass(activeEmotion, 'active')) Modals.close(activeEmotion);

        const sosOverlay = DOM.get('sos-overlay');
        if (sosOverlay && DOM.hasClass(sosOverlay, 'active')) SOS.close();
      }
    });
  }
};

const Navigation = {
  init() {
    this.mobileMenu();
    this.scrollEffect();
    this.smoothScroll();
  },

  mobileMenu() {
    const toggle = DOM.get("menuToggle");
    const nav = DOM.get("navLinks");
    
    if (!toggle || !nav) return;

    const clickOutside = (e) => {
      if (DOM.hasClass(nav, "active") && !nav.contains(e.target) && !toggle.contains(e.target)) {
        this.close(nav, toggle);
        document.removeEventListener("click", clickOutside);
      }
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = DOM.toggleClass(nav, "active");
      DOM.setAttr(toggle, "aria-expanded", isActive);

      if (isActive) {
        document.addEventListener("click", clickOutside);
      } else {
        document.removeEventListener("click", clickOutside);
      }
    });

    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      this.close(nav, toggle);
      document.removeEventListener("click", clickOutside);
    }));
  },

  close(nav, toggle) {
    DOM.removeClass(nav, "active");
    DOM.setAttr(toggle, "aria-expanded", "false");
  },

  scrollEffect() {
    const header = DOM.get("header");
    if (!header) return;

    let lastScroll = 0;
    window.addEventListener("scroll", () => {
      const now = Date.now();
      if (now - lastScroll >= CONFIG.scroll.throttleMs) {
        window.scrollY > CONFIG.scroll.threshold
          ? DOM.addClass(header, "scrolled")
          : DOM.removeClass(header, "scrolled");
        lastScroll = now;
      }
    }, { passive: true });
  },

  smoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener("click", (e) => {
        const rawId = anchor.getAttribute("href").substring(1);
        const safeId = Validators.safeId(rawId);

        if (!safeId) return;

        const target = document.getElementById(safeId);
        if (target) {
          e.preventDefault();
          const offset = target.getBoundingClientRect().top + window.pageYOffset - 60;
          window.scrollTo({ top: offset, behavior: "smooth" });
        }
      });
    });
  }
};

const Modals = {
  init() {
    document.body.addEventListener('click', (e) => {
      const openBtn = e.target.closest('[data-action="open-modal"]');
      if (openBtn) {
        const targetId = openBtn.dataset.target;
        this.open(DOM.get(targetId));
      }
      const closeBtn = e.target.closest('.js-close-modal');
      if (closeBtn) {
        const modal = closeBtn.closest('.modal-overlay, .emotion-overlay');
        this.close(modal);
      }
    });
  },

  open(modal) {
    if (!modal) return;
    DOM.setAttr(modal, 'aria-modal', 'true');
    DOM.setAttr(modal, 'role', 'dialog');

    const displayType = modal.id === 'emotion-card-overlay' ? 'flex' : 'block';
    DOM.setStyle(modal, { display: displayType });
    setTimeout(() => DOM.addClass(modal, 'active'), 10);
    document.body.style.overflow = 'hidden';
  },

  close(modal) {
    if (!modal) return;
    DOM.removeClass(modal, 'active');
    modal.removeAttribute('aria-modal');
    modal.removeAttribute('role');

    const onEnd = (e) => {
      if (e.target === modal) {
        DOM.setStyle(modal, { display: 'none' });
        modal.removeEventListener('transitionend', onEnd);
      }
    };
    modal.addEventListener('transitionend', onEnd, { once: true });

    setTimeout(() => {
      if (!DOM.hasClass(modal, 'active')) DOM.setStyle(modal, { display: 'none' });
    }, 350);

    document.body.style.overflow = 'auto';
  }
};

const Animations = {
  init() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target.classList.contains("stat-number")) {
            this.animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
          DOM.setStyle(entry.target, { opacity: "1", transform: "translateY(0)" });
        }
      });
    }, { threshold: CONFIG.animation.threshold });

    const selectors = ".stat-number, .service-card, .testimonial-card, .blog-card, .contact-item, .pricing-card, .process-step, .quiz-container, .roi-container, .tool-card";
    DOM.getAll(selectors).forEach((el) => {
      if (!el.classList.contains('stat-number')) {
        DOM.setStyle(el, { opacity: "0", transform: "translateY(30px)", transition: "opacity 0.6s ease, transform 0.6s ease" });
      }
      observer.observe(el);
    });
  },

  animateCounter(el) {
    const target = Validators.number(el.getAttribute("data-count"), 0, 10000000);
    if (!target || el.dataset.animated) return;

    const label = el.parentElement?.querySelector(".stat-label");
    const suffix = label?.textContent.includes("Satisfacción") ? "%" : "";
    const startTime = performance.now();

    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / CONFIG.animation.duration, 1);
      el.textContent = Math.floor(target * progress) + suffix;
      progress < 1 ? requestAnimationFrame(animate) : el.dataset.animated = 'true';
    };
    requestAnimationFrame(animate);
  }
};

const Accordion = {
  init() {
    DOM.getAll(".faq-question").forEach(q => q.addEventListener("click", () => this.toggle(q)));
  },

  toggle(question) {
    const answer = question.nextElementSibling;
    const parent = question.closest(".faq-category");

    if (parent) {
      parent.querySelectorAll('.faq-question.active').forEach((q) => {
        if (q !== question) {
          DOM.removeClass(q, "active");
          DOM.setAttr(q, "aria-expanded", "false");
          if (q.nextElementSibling) {
            DOM.removeClass(q.nextElementSibling, "open");
            DOM.setStyle(q.nextElementSibling, { maxHeight: "0" });
          }
        }
      });
    }

    const isOpen = DOM.toggleClass(question, "active");
    DOM.setAttr(question, "aria-expanded", isOpen);
    if (answer) {
      DOM.toggleClass(answer, "open");
      DOM.setStyle(answer, { maxHeight: isOpen ? Math.abs(answer.scrollHeight) + "px" : "0" });
    }
  }
};


/* =========================================
   4. CALCULATOR & QUIZ MODULES
   ========================================= */

const ROI = {
  state: { context: 'ansiedad' },
  contexts: {
    ansiedad: {
      lDays: 'Días con "ruido mental"',
      lInt: 'Nivel de preocupación',
      benefit: 'dormir sin preocupaciones, apagar el sobre-análisis y disfrutar el presente.'
    },
    burnout: {
      lDays: 'Días de agotamiento total',
      lInt: 'Nivel de estrés laboral',
      benefit: 'descansar el fin de semana sin culpa y recuperar tu energía vital.'
    },
    pareja: {
      lDays: 'Días de conflicto o silencio',
      lInt: 'Intensidad del malestar',
      benefit: 'reconectar con tu pareja, dejar de discutir y sentirte comprendido.'
    },
    apatia: {
      lDays: 'Días "grises" o sin ganas',
      lInt: 'Nivel de desánimo',
      benefit: 'volver a sentir motivación y disfrutar de las pequeñas cosas otra vez.'
    }
  },

  init() {
    this.els = {
      days: DOM.get('in-days'),
      int: DOM.get('in-int'),
      val: DOM.get('in-val'),
      dispDays: DOM.get('dsp-days'),
      dispInt: DOM.get('dsp-int'),
      dispVal: DOM.get('dsp-val'),
      lblDays: DOM.get('lbl-days'),
      lblInt: DOM.get('lbl-int'),
      resX: DOM.get('res-x'),
      chart: DOM.get('chart-ring'),
      interp: DOM.get('interp-text')
    };

    if (!this.els.days) return;

    [this.els.days, this.els.int, this.els.val].forEach(el => {
      el?.addEventListener('input', () => this.calculate());
    });

    DOM.getAll('.feeder-chip').forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn));
    });

    this.calculate();
  },

  setMode(btn) {
    DOM.getAll('.feeder-chip').forEach(b => DOM.removeClass(b, 'active'));
    DOM.addClass(btn, 'active');
    
    this.state.context = btn.dataset.mode;
    const data = this.contexts[this.state.context];
    const grid = DOM.get('calculatorGrid');

    if (grid) grid.style.opacity = '0.6';
    
    setTimeout(() => {
      DOM.setText(this.els.lblDays, data.lDays);
      DOM.setText(this.els.lblInt, data.lInt);
      if (grid) grid.style.opacity = '1';
      this.calculate();
    }, 200);
  },

  calculate() {
    const days = Validators.number(this.els.days.value, 0, 30);
    const intensity = Validators.number(this.els.int.value, 1, 10);
    const value = Validators.number(this.els.val.value, 200, 3000);
    const therapyCost = 1400;

    DOM.setText(this.els.dispDays, `${days} días/mes`);
    DOM.setText(this.els.dispInt, `Nivel ${intensity}`);
    DOM.setText(this.els.dispVal, `$${value}`);

    const factor = intensity / 10;
    const emotionalCost = Math.round(days * value * factor);
    
    let multiplier = (emotionalCost / therapyCost).toFixed(1);
    if(multiplier < 0.5) multiplier = "0.5";

    const hours = days * 4;

    DOM.setText(this.els.resX, `${multiplier}x`);

    const total = emotionalCost + therapyCost;
    const percent = Math.min(95, Math.max(5, (emotionalCost / total) * 100));
    if (this.els.chart) {
      this.els.chart.style.background = `conic-gradient(#EF4444 0% ${percent}%, #10B981 ${percent}% 100%)`;
    }

    const benefitText = this.contexts[this.state.context].benefit;
    if (this.els.interp) {
      this.els.interp.innerHTML = `
        Recuperas <span class="highlight-brown">${multiplier} veces</span> tu inversión en calidad de vida.
        <br><br>
        Esto equivale a ganar <span class="highlight-purple">${hours} horas al mes</span> libres de malestar para 
        <span>${benefitText}</span>
      `;
    }
  }
};


/* =========================================
   5. WELLNESS TOOLS (QUIZ, JAR, EMOTIONS)
   ========================================= */

const Tools = {
  init() {
    this.setupToggles();
    this.setupAnxietyQuiz();
    this.setupLoadCheckbox();
  },

  setupToggles() {
    [['btn-text-quiz', 'content-quiz'], ['btn-text-load', 'content-load']].forEach(([btnId, contentId]) => {
      const btn = DOM.get(btnId),
        content = DOM.get(contentId);
      if (btn && content) {
        btn.addEventListener('click', () => {
          const isActive = DOM.toggleClass(content, 'active');
          DOM.setText(btn, isActive ? 'Cerrar Herramienta' : (btnId.includes('quiz') ? 'Iniciar Mini Test' : 'Medir mi Carga'));
        });
      }
    });
  },

  setupAnxietyQuiz() {
    const scores = { 1: null, 2: null, 3: null, 4: null };
    const resultBox = DOM.get('phq4-result');

    DOM.getAll('.quiz-options-group .option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.quiz-options-group');
        const qId = Validators.number(parent.dataset.q, 1, 4);
        const val = Validators.number(btn.dataset.val, 0, 3);

        parent.querySelectorAll('.option-btn').forEach(b => DOM.removeClass(b, 'selected'));
        DOM.addClass(btn, 'selected');

        scores[qId] = val;

        if (scores[1] !== null && scores[2] !== null && scores[3] !== null && scores[4] !== null) {
          this.calculatePHQ4(scores, resultBox);
        }
      });
    });
  },

  calculatePHQ4(scores, container) {
    const total = scores[1] + scores[2] + scores[3] + scores[4];
    let level = '', color = '', advice = '', cta = '';

    if (total <= 2) {
      level = "Rango Normal";
      color = "#10B981";
      advice = "No presentas síntomas significativos de ansiedad o depresión actualmente.";
      cta = `<a href="#jar-display" class="btn-tool btn-green" style="margin-top:10px; font-size:0.9rem; width:100%; display:block; text-decoration:none;">Fortalece tu mente (Tarro de Calma)</a>`;
    } else if (total <= 5) {
      level = "Sintomatología Leve";
      color = "#F59E0B";
      advice = "Podrías estar experimentando inquietud ligera o días bajos. Es preventivo actuar ahora.";
      cta = `<button type="button" class="btn-tool btn-orange" data-action="start-bodyscan-direct" style="margin-top:10px; font-size:0.9rem; width:100%;">Regularme con Escaneo Corporal</button>`;
    } else if (total <= 8) {
      level = "Sintomatología Moderada";
      color = "#F97316";
      advice = "Es probable que la ansiedad o el desánimo estén complicando tu rutina diaria.";
      cta = `<a href="https://wa.me/5214491996086?text=Hola,%20hice%20el%20test%20PHQ4%20y%20salió%20Moderado." target="_blank" rel="noopener noreferrer" class="btn-tool btn-orange" style="margin-top:10px; font-size:0.9rem; display:block; text-decoration:none; width:100%;">Consultar Evaluación Pro</a>`;
    } else {
      level = "Sintomatología Severa";
      color = "#EF4444";
      advice = "Estos niveles indican una carga emocional alta que merece atención profesional prioritaria.";
      cta = `<a href="https://wa.me/5214491996086?text=Hola,%20hice%20el%20test%20PHQ4%20y%20salió%20Alto." target="_blank" rel="noopener noreferrer" class="btn-tool btn-purple" style="margin-top:10px; font-size:0.9rem; display:block; text-decoration:none; width:100%;">Agendar Cita Prioritaria</a>`;
    }

    container.style.display = 'block';
    container.style.borderLeft = `5px solid ${color}`;
    container.innerHTML = `
            <div style="margin-bottom:5px; font-size:0.85rem; text-transform:uppercase; color:#6B7280; font-weight:700;">Puntaje PHQ-4: ${total}/12</div>
            <h4 style="color:${color}; margin-bottom:0.5rem; font-size:1.2rem;">${level}</h4>
            <p style="font-size:0.95rem; line-height:1.5; margin-bottom:1rem;">${advice}</p>
            ${cta}
        `;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  setupLoadCheckbox() {
    const items = DOM.getAll('.check-item');
    const bar = DOM.get('load-bar');
    const text = DOM.get('load-text');
    const advice = DOM.get('load-advice');
    
    if (!items.length) return;

    const updates = {
      0: { l: "Baja", c: "#10B981", t: "Tu mochila está ligera. Es un buen momento para disfrutar o avanzar en proyectos personales." },
      1: { l: "Manejable", c: "#10B981", t: "Tienes retos, pero son sostenibles. Enfócate en resolver uno a la vez para mantener el equilibrio." },
      2: { l: "Moderada", c: "#F59E0B", t: "Empieza a pesar. <strong>Estrategia:</strong> Escribe tus pendientes en papel para sacarlos de tu cabeza." },
      3: { l: "Elevada", c: "#F97316", t: "Cuidado. <strong>Estrategia:</strong> Aplica la regla 'Eliminar, Delegar o Posponer'. Suelta una cosa hoy." },
      4: { l: "Muy Alta", c: "#EF4444", t: "Estás en zona de riesgo. <strong>Estrategia:</strong> Detente. No aceptes ni un solo compromiso más esta semana." },
      5: { l: "Crítica", c: "#EF4444", t: "Sobrecarga total. Tu única prioridad ahora es descansar. Pide ayuda o reprograma todo lo no esencial." },
      6: { l: "Crítica", c: "#EF4444", t: "Sobrecarga total. Tu única prioridad ahora es descansar. Pide ayuda o reprograma todo lo no esencial." }
    };

    items.forEach(item => {
      item.addEventListener('click', () => {
        DOM.toggleClass(item, 'active');
        if (DOM.hasClass(item, 'active')) {
          DOM.setStyle(item, { background: '#F0FDF4', borderColor: '#10B981', fontWeight: '700' });
        } else {
          DOM.setStyle(item, { background: '#fff', borderColor: 'rgba(0,0,0,0.05)', fontWeight: '400' });
        }

        const activeCount = DOM.getAll('.check-item.active').length;
        const percent = (activeCount / items.length) * 100;
        const data = updates[activeCount];

        if (bar) DOM.setStyle(bar, { width: `${percent}%`, background: data.c });
        if (text) {
          DOM.setText(text, data.l);
          text.style.color = data.c;
        }
        if (advice) advice.innerHTML = data.t;
      });
    });
  }
};

const Jar = {
  frases: [
    "No tienes que poder con todo.", "Hacer una pausa es avanzar.", "Eres suficiente tal como eres.",
    "Respira, es solo un momento.", "Sé amable contigo mismo hoy.", "Tu paz mental es una prioridad.",
    "Un día a la vez es suficiente.", "Está bien no estar bien a veces.", "Confía en tu propio proceso.",
    "Eres más fuerte de lo que crees.", "Esto también pasará.", "Mereces descansar sin sentir culpa.",
    "Pequeños pasos también te llevan lejos.", "Escucha lo que tu cuerpo necesita hoy.",
    "No te compares, tu camino es único.", "Lo estás haciendo lo mejor que puedes.",
    "Date permiso para sentir tus emociones.", "Hoy es una nueva oportunidad para empezar.",
    "Abraza tus emociones, son solo mensajeras.", "La calma es un superpoder que llevas dentro.",
    "Eres capaz de cosas asombrosas.", "Inhala paz, exhala lo que no puedes controlar.",
    "Tu valor no depende de tu productividad.", "Agradece a tu cuerpo por sostenerte.",
    "Todo empieza con amarte a ti mismo.", "Eres luz, incluso en los días grises.",
    "Suelta lo que pesa y vuela ligero.", "Tu presencia es un regalo para el mundo.",
    "Cuidar de ti no es egoísmo, es necesidad.", "Sigue adelante, el mundo te necesita."
  ],
  init() {
    const btn = DOM.get('btn-open-jar');
    const display = DOM.get('jar-display');
    if (!btn || !display) return;

    btn.addEventListener('click', () => {
      DOM.setStyle(display, { transform: 'scale(0.98)', opacity: '0.8' });
      setTimeout(() => {
        const frase = this.frases[Math.floor(Math.random() * this.frases.length)];
        DOM.clear(display);
        const p = DOM.create('p', { className: 'jar-message-text', text: `"${frase}"` });
        display.appendChild(p);
        DOM.setStyle(display, { transform: 'scale(1)', opacity: '1' });
        DOM.setText(btn, "✨ Abrir otra dosis ✨");
      }, 200);
    });
  }
};

const Emotions = {
  data: [{
      name: 'Enojo',
      color: 'linear-gradient(135deg, #EF4444, #B91C1C)',
      emoji: '😡',
      size: 'bubble-lg',
      desc: 'Respuesta de defensa. Algo o alguien ha cruzado un límite o ha sido injusto.',
      nuances: 'Frustración • Irritabilidad • Rencor • Envidia • Indignación',
      tip: 'Misión: "Descarga Segura". Escribe lo que te molesta en un papel con fuerza, y luego rómpelo.'
    },
    {
      name: 'Tristeza',
      color: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
      emoji: '😢',
      size: 'bubble-md',
      desc: 'Proceso de duelo. Tu mente necesita pausa para procesar una pérdida o cambio.',
      nuances: 'Desánimo • Nostalgia • Soledad • Decepción • Culpabilidad',
      tip: 'Misión: "Refugio". Abrázate a ti mismo/a por 30 segundos o envuélvete en una manta. Date calor.'
    },
    {
      name: 'Ansiedad',
      color: 'linear-gradient(135deg, #A855F7, #7E22CE)',
      emoji: '😰',
      size: 'bubble-lg',
      desc: 'Alerta de futuro. Tu cerebro percibe una amenaza incierta y prepara el cuerpo para huir.',
      nuances: 'Nerviosismo • Preocupación • Pánico • Inseguridad • Miedo',
      tip: 'Misión: "Aterrizaje". Toca 4 objetos con texturas diferentes a tu alrededor ahora mismo.'
    },
    {
      name: 'Calma',
      color: 'linear-gradient(135deg, #10B981, #047857)',
      emoji: '😌',
      size: 'bubble-sm',
      desc: 'Estado de seguridad. Tu sistema nervioso está en equilibrio y recuperación.',
      nuances: 'Paz • Gratitud • Alivio • Confianza • Claridad',
      tip: 'Misión: "Anclaje". Respira hondo y guarda una foto mental de este momento para cuando lo necesites.'
    },
    {
      name: 'Agotado',
      color: 'linear-gradient(135deg, #F59E0B, #B45309)',
      emoji: '😫',
      size: 'bubble-md',
      desc: 'Deuda energética. Has gastado más recursos físicos o mentales de los que tenías.',
      nuances: 'Fatiga • Hartazgo • Burnout • Pesadez • Apatía',
      tip: 'Misión: "Modo Avión". Cierra los ojos 5 minutos. No intentes resolver nada ahora.'
    },
    {
      name: 'Confusión',
      color: 'linear-gradient(135deg, #64748B, #334155)',
      emoji: '🌀',
      size: 'bubble-sm',
      desc: 'Sobrecarga de información. Muchas emociones están mezcladas y compitiendo.',
      nuances: 'Duda • Bloqueo • Aturdimiento • Indecisión • Caos',
      tip: 'Misión: "Vaciado". Escribe una lista rápida de todo lo que tienes en la cabeza sin filtro.'
    }
  ],
  init() {
    const container = DOM.get('bubbles-container');
    const overlay = DOM.get('emotion-card-overlay');
    if (!container || !overlay) return;

    DOM.clear(container);

    this.data.forEach(emo => {
      const b = DOM.create('div', {
        className: `emotion-bubble ${emo.size}`,
        text: emo.name,
        style: { background: emo.color },
        attrs: { role: 'button', tabindex: '0' }
      });

      const open = () => this.open(emo, overlay);
      b.onclick = open;
      b.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      };
      container.appendChild(b);
    });

    DOM.get('close-emotion-btn')?.addEventListener('click', () => Modals.close(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) Modals.close(overlay); });
  },

  open(data, overlay) {
    const els = {
      title: DOM.get('emotion-title'),
      icon: DOM.get('emotion-icon'),
      desc: DOM.get('emotion-desc'),
      tip: DOM.get('emotion-tip'),
      header: DOM.get('emotion-header-bg')
    };

    if (els.title) DOM.setText(els.title, data.name);
    if (els.icon) DOM.setText(els.icon, data.emoji);
    if (els.header) els.header.style.background = data.color;

    if (els.desc) {
      const colorMatch = data.color.match(/#[A-Fa-f0-9]{6}/);
      const hexColor = colorMatch ? colorMatch[0] : '#8B5CF6';

      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const pastelBg = `rgba(${r}, ${g}, ${b}, 0.08)`;
      const pastelBorder = `rgba(${r}, ${g}, ${b}, 0.2)`;

      els.desc.innerHTML = `
        <div style="margin-bottom:1.2rem;">
            <strong>🔍 El Mensaje:</strong><br>
            <span style="color:#4B5563;">${data.desc}</span>
        </div>
        <div class="emotion-nuances-box" style="background:${pastelBg}; border:1px solid ${pastelBorder};">
            <strong>SE PUEDE SENTIR COMO:</strong>
            <span style="font-weight:600; color:#475569;">${data.nuances}</span>
        </div>
    `;
    }

    if (els.tip) DOM.setText(els.tip, data.tip);

    Modals.open(overlay);
    setTimeout(() => overlay.querySelector('.close-modal-btn')?.focus(), 50);
  }
};


/* =========================================
   6. COMPLEX TOOLS (BREATHING, BODY SCAN, SOS)
   ========================================= */

const BreathingTool = {
  modes: {
    calm: {
      phases: [{ l: "INHALA", d: 4000, s: 1.3 }, { l: "RETÉN", d: 7000, s: 1.3 }, { l: "EXHALA", d: 8000, s: 1.0 }],
      color: "#3B82F6", max: 4,
      text: "Estimula el nervio vago para 'apagar' la alerta cerebral y bajar el ritmo cardíaco."
    },
    focus: {
      phases: [{ l: "INHALA", d: 4000, s: 1.3 }, { l: "AGUANTA", d: 4000, s: 1.3 }, { l: "EXHALA", d: 4000, s: 1.0 }, { l: "ESPERA", d: 4000, s: 1.0 }],
      color: "#8B5CF6", max: 4,
      text: "Equilibra el CO2 en sangre para recuperar la claridad mental y el enfoque."
    },
    sleep: {
      phases: [{ l: "INHALA", d: 4000, s: 1.3 }, { l: "EXHALA", d: 8000, s: 1.0 }],
      color: "#4F46E5", max: 10,
      text: "Imita el ritmo respiratorio del sueño profundo para facilitar el descanso."
    },
    balance: {
      phases: [{ l: "INHALA", d: 5000, s: 1.3 }, { l: "EXHALA", d: 5000, s: 1.0 }],
      color: "#10B981", max: 6,
      text: "Genera coherencia cardíaca para regular emociones intensas y volver a tu centro."
    }
  },
  state: { isRunning: false, isPaused: false, mode: null, phaseIdx: 0, cycle: 1, startTs: 0, pauseAcc: 0, rafId: null },
  els: {},

  init() {
    this.els = {
      circle: DOM.get('btCircle'),
      label: DOM.get('btLabel'),
      cycle: DOM.get('btCycleCount'),
      max: DOM.get('btMaxCycles'),
      timer: DOM.get('btTimer'),
      pause: DOM.get('btPauseBtn'),
      reset: DOM.get('btResetBtn'),
      instr: DOM.get('btInstructions')
    };
    if (!this.els.circle) return;

    const savedMode = Storage.get(CONFIG.storageKeys.breathingMode);

    DOM.getAll('.bt-mode-btn').forEach(btn => {
      const modeKey = btn.dataset.mode;
      if (this.modes[modeKey] && modeKey === savedMode) DOM.addClass(btn, 'active');

      btn.addEventListener('click', () => {
        if (!this.modes[modeKey]) return;
        DOM.getAll('.bt-mode-btn').forEach(b => DOM.removeClass(b, 'active'));
        DOM.addClass(btn, 'active');
        this.start(modeKey);
      });
    });

    this.els.pause?.addEventListener('click', () => this.togglePause());
    this.els.reset?.addEventListener('click', () => this.reset(true));
  },

  start(modeKey) {
    if (!this.modes[modeKey]) return;

    if (this.state.rafId) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }

    Storage.set(CONFIG.storageKeys.breathingMode, modeKey);

    this.state = {
      isRunning: true,
      isPaused: false,
      mode: this.modes[modeKey],
      phaseIdx: 0,
      cycle: 1,
      startTs: Date.now(),
      pauseAcc: 0,
      rafId: null,
      baseScale: 1.0,
      lastPauseTs: 0
    };

    if (this.els.max) DOM.setText(this.els.max, this.state.mode.max);

    if (this.els.instr) {
      DOM.setText(this.els.instr, this.state.mode.text);
      DOM.setStyle(this.els.instr, {
        backgroundColor: this.state.mode.color + '25',
        border: `1px solid ${this.state.mode.color}40`,
        padding: '1rem',
        borderRadius: '16px',
        color: '#1F2937',
        transition: 'all 0.3s ease'
      });
    }

    this.updateUI(true);
    this.tick();
  },

  tick() {
    if (!this.state.isRunning || this.state.isPaused) return;

    const now = Date.now();
    const elapsed = now - this.state.startTs - this.state.pauseAcc;
    const phase = this.state.mode.phases[this.state.phaseIdx];
    const progress = Math.min(elapsed / phase.d, 1);

    if (this.els.timer) DOM.setText(this.els.timer, Math.ceil((phase.d - elapsed) / 1000) + "s");

    if (progress >= 1) {
      this.state.baseScale = phase.s;
      this.state.phaseIdx++;
      this.state.startTs = now;
      this.state.pauseAcc = 0;

      if (this.state.phaseIdx >= this.state.mode.phases.length) {
        this.state.phaseIdx = 0;
        this.state.cycle++;
        if (this.els.cycle) DOM.setText(this.els.cycle, this.state.cycle);

        if (this.state.cycle > this.state.mode.max) return this.complete();
      }
    }

    this.render(progress, phase);
    this.state.rafId = requestAnimationFrame(() => this.tick());
  },

  render(progress, phase) {
    const ease = -(Math.cos(Math.PI * progress) - 1) / 2;
    const currentScale = this.state.baseScale + (phase.s - this.state.baseScale) * ease;

    if (this.els.circle) {
      DOM.setStyle(this.els.circle, {
        transform: `scale(${currentScale})`,
        backgroundColor: this.state.mode.color
      });
    }
    if (this.els.label) {
      DOM.setText(this.els.label, phase.l);
      DOM.setStyle(this.els.label, { transform: `scale(${1/currentScale})` });
    }
  },

  togglePause() {
    if (!this.state.isRunning) return;
    this.state.isPaused = !this.state.isPaused;

    if (this.state.isPaused) {
      this.state.lastPauseTs = Date.now();
      if (this.els.pause) DOM.setText(this.els.pause, "▶️ Continuar");
      cancelAnimationFrame(this.state.rafId);
    } else {
      this.state.pauseAcc += (Date.now() - this.state.lastPauseTs);
      if (this.els.pause) DOM.setText(this.els.pause, "⏸ Pausar");
      this.tick();
    }
  },

  complete() {
    this.state.isRunning = false;
    if (this.state.rafId) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
    if (this.els.label) DOM.setText(this.els.label, "¡BIEN!");
    if (this.els.timer) DOM.setText(this.els.timer, "FIN");
    if (this.els.instr) DOM.setText(this.els.instr, "Ejercicio completado. ¡Bien hecho!");
    if (this.els.pause) this.els.pause.disabled = true;
  },

  reset(clearUI) {
    if (this.state.rafId) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
    this.state.isRunning = false;

    if (clearUI) {
      DOM.setStyle(this.els.circle, { transform: 'scale(1)', backgroundColor: '#E2E8F0' });
      if (this.els.label) {
        DOM.setText(this.els.label, "ELEGIR");
        this.els.label.style.transform = 'scale(1)';
      }
      if (this.els.cycle) DOM.setText(this.els.cycle, "0");
      if (this.els.max) DOM.setText(this.els.max, "-");
      if (this.els.timer) DOM.setText(this.els.timer, "0:00");

      if (this.els.instr) {
        DOM.setText(this.els.instr, "Selecciona un modo arriba para comenzar");
        DOM.setStyle(this.els.instr, {
          backgroundColor: 'transparent',
          border: 'none',
          padding: '0',
          color: 'inherit'
        });
      }

      if (this.els.pause) {
        this.els.pause.disabled = true;
        DOM.setText(this.els.pause, "⏸ Pausar");
      }
      DOM.getAll('.bt-mode-btn').forEach(b => DOM.removeClass(b, 'active'));
    }
  },

  updateUI(running) {
    if (this.els.pause) {
      this.els.pause.disabled = !running;
      DOM.setText(this.els.pause, "⏸ Pausar");
    }
    if (this.els.reset) this.els.reset.disabled = !running;
    if (this.els.cycle) DOM.setText(this.els.cycle, "1");
  }
};

const BodyScan = {
  state: { active: false, step: 0, timer: null, paused: false, sessionId: 0 },
  steps: [
    { id: 'svg-head', label: 'Cabeza y Cara' },
    { id: 'svg-shoulders', label: 'Hombros y Cuello' },
    { id: 'svg-arms', label: 'Brazos y Manos' },
    { id: 'svg-torso', label: 'Pecho y Estómago' },
    { id: 'svg-legs', label: 'Piernas y Pies' }
  ],

  init() {
    // Inicialización pasiva
  },

  screen(id) {
    if (!Validators.safeId(id)) return;
    DOM.hideAll('.sos-screen');
    const el = DOM.get(id);
    if (el) DOM.addClass(el, 'active');
  },

  open() {
    if (typeof SOS !== 'undefined') SOS.close(true);

    const overlay = DOM.get('sos-overlay');
    if (overlay) {
      this.stop();
      Modals.open(overlay);
      this.screen('sos-screen-bs-intro');
    }
  },

  start() {
    this.stop();
    this.state.sessionId = Date.now();
    this.state.step = 0;
    this.state.active = true;
    this.state.paused = false;

    this.screen('sos-screen-bs-active');

    const btn = DOM.get('btn-bs-pause');
    if (btn) {
      DOM.setText(btn, "⏸ Pausar");
      DOM.removeClass(btn, 'paused');
    }

    setTimeout(() => {
      this.run(this.state.sessionId);
    }, 50);
  },

  run(sessionId) {
    if (sessionId !== this.state.sessionId) return;
    if (!this.state.active || this.state.paused) return;

    if (this.state.step >= this.steps.length) return this.screen('sos-screen-bs-final');

    if (this.state.timer) clearTimeout(this.state.timer);

    const data = this.steps[this.state.step];
    const instr = DOM.get('bs-text-instruction');
    const svg = DOM.get(data.id);

    DOM.getAll('.bs-dot').forEach((d, i) => {
      if (i < this.state.step) DOM.addClass(d, 'completed');
      else if (i === this.state.step) DOM.addClass(d, 'active');
      else DOM.removeClass(d, 'active');
    });

    if (instr) DOM.setText(instr, `Frunce y tensa fuerte: ${data.label}...`);
    if (svg) DOM.addClass(svg, 'fill-active');

    this.state.timer = setTimeout(() => {
      if (sessionId !== this.state.sessionId) return;
      if (!this.state.active || this.state.paused) return;

      if (instr) DOM.setText(instr, `Suelta el aire y relaja: ${data.label}...`);
      if (svg) {
        DOM.removeClass(svg, 'fill-active');
        DOM.addClass(svg, 'fill-relax');
      }

      this.state.timer = setTimeout(() => {
        if (sessionId !== this.state.sessionId) return;
        if (!this.state.active || this.state.paused) return;

        this.state.step++;
        this.run(sessionId);
      }, 4000);
    }, 4000);
  },

  toggle() {
    const btn = DOM.get('btn-bs-pause');
    const instr = DOM.get('bs-text-instruction');

    if (this.state.paused) {
      this.state.paused = false;
      if (btn) {
        DOM.setText(btn, "⏸ Pausar");
        DOM.removeClass(btn, 'paused');
      }
      if (instr) DOM.setText(instr, "Reanudando...");
      this.run(this.state.sessionId);
    } else {
      this.state.paused = true;
      if (this.state.timer) clearTimeout(this.state.timer);
      if (btn) {
        DOM.setText(btn, "▶️ Reanudar");
        DOM.addClass(btn, 'paused');
      }
      if (instr) DOM.setText(instr, "Ejercicio en pausa");
    }
  },

  stop() {
    this.state.active = false;
    this.state.paused = false;
    if (this.state.timer) {
      clearTimeout(this.state.timer);
      this.state.timer = null;
    }
    DOM.getAll('.body-path, .bs-dot').forEach(e => {
      DOM.removeClass(e, 'fill-active');
      DOM.removeClass(e, 'fill-relax');
      DOM.removeClass(e, 'active');
      DOM.removeClass(e, 'completed');
    });
  }
};

const SOS = {
  state: { crisisActive: false, crisisRaf: null, groundingIdx: 0 },

  groundingSteps: [
    { icon: '👁️', title: 'Vista', text: 'Encuentra 5 cosas de color azul', color: '#3B82F6' },
    { icon: '✋', title: 'Tacto', text: 'Toca 4 cosas con texturas diferentes', color: '#F59E0B' },
    { icon: '👂', title: 'Oído', text: 'Identifica 3 sonidos lejanos', color: '#10B981' },
    { icon: '🐓', title: 'Olfato', text: 'Identifica 2 olores', color: '#EC4899' },
    { icon: '❤️', title: 'Emoción', text: 'Di 1 cosa buena sobre ti', color: '#8B5CF6' }
  ],

  init() {
    const trigger = DOM.get('btn-sos-trigger');
    const overlay = DOM.get('sos-overlay');
    if (!trigger || !overlay) return;

    trigger.addEventListener('click', () => {
      if (typeof BodyScan !== 'undefined') BodyScan.stop();
      Modals.open(overlay);
      this.reset();
    });

    DOM.get('close-sos-btn')?.addEventListener('click', () => this.close());
  },

  screen(id) {
    if (!Validators.safeId(id)) return;
    DOM.hideAll('.sos-screen');
    const el = DOM.get(id);
    if (el) DOM.addClass(el, 'active');
  },

  close(silent = false) {
    const overlay = DOM.get('sos-overlay');
    if (!overlay) return;

    if (silent) {
      DOM.removeClass(overlay, 'active');
      DOM.setStyle(overlay, { display: 'none' });
      document.body.style.overflow = 'auto';
      this.stopAll();
      return;
    }

    Modals.close(overlay);
    this.stopAll();
  },

  reset() {
    this.stopAll();
    this.screen('sos-screen-1');
  },

  stopAll() {
    this.crisisStop();
    this.state.groundingIdx = 0;
    if (typeof BodyScan !== 'undefined') BodyScan.stop();
  },

  route(choice) {
    const map = {
      'suicide': 'sos-screen-suicide-validation',
      'triage-2': 'sos-screen-triage-2',
      'risk': 'sos-screen-risk',
      'disconnect': 'sos-screen-bs-intro',
      'panic': 'sos-screen-calm-intro'
    };
    if (Object.prototype.hasOwnProperty.call(map, choice)) this.screen(map[choice]);
  },

  crisisStart() {
    this.crisisStop();
    this.screen('sos-screen-suicide-breathing');
    this.state.crisisActive = true;
    const start = Date.now();
    const instrElement = DOM.get('sosInstructionText');
    const label = DOM.get('sosLabel');
    const circle = DOM.get('sosCircle');

    const tick = () => {
      if (!this.state.crisisActive) return;
      const elapsed = (Date.now() - start) % 19000;
      let scale = 1,
        text = "INHALA",
        subText = "";

      if (elapsed < 4000) {
        scale = 1 + (elapsed / 4000) * 0.2;
        subText = "Inhala suave por la nariz...";
      } else if (elapsed < 11000) {
        scale = 1.2;
        text = "RETÉN";
        subText = "Mantén el aire un momento...";
      } else {
        scale = 1.2 - ((elapsed - 11000) / 8000) * 0.2;
        text = "EXHALA";
        subText = "Suelta todo el aire por la boca...";
      }

      if (circle) circle.style.transform = `scale(${scale})`;
      if (label && label.textContent !== text) DOM.setText(label, text);
      if (instrElement && instrElement.textContent !== subText) DOM.setText(instrElement, subText);

      this.state.crisisRaf = requestAnimationFrame(tick);
    };
    tick();
  },

  crisisStop() {
    this.state.crisisActive = false;
    if (this.state.crisisRaf) {
      cancelAnimationFrame(this.state.crisisRaf);
      this.state.crisisRaf = null;
    }
  },

  groundingStart() {
    this.state.groundingIdx = 0;
    this.screen('sos-screen-grounding');
    this.groundingUpdateUI();
  },

  groundingNext() {
    this.state.groundingIdx++;
    if (this.state.groundingIdx < this.groundingSteps.length) {
      this.groundingUpdateUI();
    } else {
      this.screen('sos-screen-final');
    }
  },

  groundingUpdateUI() {
    const step = this.groundingSteps[this.state.groundingIdx];
    const icon = DOM.get('grounding-icon');
    const title = DOM.get('grounding-title');
    const text = DOM.get('grounding-text');

    DOM.setStyle(icon, { transform: 'scale(0.8)', opacity: '0' });
    setTimeout(() => {
      if (icon) DOM.setText(icon, step.icon);
      if (title) {
        DOM.setText(title, step.title);
        title.style.color = step.color;
      }
      if (text) DOM.setText(text, step.text);

      DOM.getAll('.grounding-dot').forEach((d, i) => {
        i <= this.state.groundingIdx ? DOM.addClass(d, 'active') : DOM.removeClass(d, 'active');
      });
      DOM.setStyle(icon, { transform: 'scale(1)', opacity: '1', transition: 'all 0.3s ease' });
    }, 150);
  }
};


/* =========================================
   7. INITIALIZATION & EXECUTION
   ========================================= */

const safeInit = (module, name) => {
  try {
    module.init();
  } catch (e) {
    console.error(`Error inicializando módulo ${name}:`, e);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Core y Globales
  safeInit(Navigation, 'Navigation');
  safeInit(Modals, 'Modals');
  safeInit(Accessibility, 'Accessibility');

  const isHomePage = document.querySelector('.hero') !== null;
  const isResourcesPage = document.body.classList.contains('page-recursos') || document.querySelector('.jar-section') !== null;

  // 2. Cargar Lógica Específica según la página
  if (isHomePage) {
    safeInit(Animations, 'Animations');
    safeInit(Accordion, 'Accordion');
    safeInit(ROI, 'ROI');
  }

  if (isResourcesPage) {
    safeInit(Animations, 'Animations');
    safeInit(Tools, 'Tools');
    safeInit(Jar, 'Jar');
    safeInit(Emotions, 'Emotions');
    safeInit(BodyScan, 'BodyScan');
    safeInit(SOS, 'SOS');
    safeInit(BreathingTool, 'BreathingTool');
  }

  /* --- 3. DELEGACIÓN DE EVENTOS CENTRALIZADA (Resource Page) --- */
  if (isResourcesPage) {
    const sosOverlay = document.getElementById('sos-overlay');

    const actions = {
      'start-grounding': () => SOS.groundingStart(),
      'next-grounding': () => SOS.groundingNext(),
      'start-bodyscan-direct': () => BodyScan.open(),
      'start-bodyscan': () => BodyScan.start(),
      'toggle-pause-bs': () => BodyScan.toggle(),
      'skip-bs': () => {
        BodyScan.stop();
        BodyScan.screen('sos-screen-bs-final');
      },
      'start-crisis-breathing': () => SOS.crisisStart(),
      'stop-crisis-breathing': () => {
          SOS.crisisStop();
          SOS.screen('sos-screen-suicide-reasons');
      },
      'show-contract': () => SOS.screen('sos-screen-suicide-contract'),
      'finish-suicide': () => SOS.screen('sos-screen-suicide-final'),
      'enable-reasons-next': () => {
          const btn = DOM.get('btn-reasons-next');
          if (btn) {
            btn.disabled = false;
            DOM.setText(btn, "Continuar");
            DOM.setStyle(btn, { opacity: 1, cursor: 'pointer' });
          }
      },
      'close-sos': () => SOS.close(),
      'finish-bs': () => SOS.close(),
      'finish-crisis': () => SOS.close(),
      'reset-sos': () => SOS.reset()
    };

    document.body.addEventListener('click', (e) => {
      // A. Botones de Acción (data-action)
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const actionName = actionBtn.dataset.action;
        if (actions[actionName]) {
          actions[actionName]();
        }
        if (actionName === 'open-modal') {
          Modals.open(document.getElementById(actionBtn.dataset.target));
        }
        if (actionName === 'open-sos' && sosOverlay) {
          if (typeof BodyScan !== 'undefined') BodyScan.stop();
          Modals.open(sosOverlay);
          SOS.reset();
        }
        return;
      }

      // B. Navegación Interna SOS (data-sos-target)
      const navBtn = e.target.closest('.js-sos-nav');
      if (navBtn) {
        const targetId = navBtn.dataset.sosTarget;
        const screens = document.querySelectorAll('.sos-screen');
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(targetId);
        if (target) target.classList.add('active');
        return;
      }

      // C. Botón cerrar SOS (X superior)
      if (e.target.closest('.js-sos-close')) {
        SOS.close();
      }
    });

    const reasonInput = document.getElementById('input-reason-name');
    if (reasonInput) {
      reasonInput.addEventListener('input', (e) => {
        // Sanitización básica de input
        const safeValue = e.target.value.replace(/[<>]/g, '');
        if (safeValue !== e.target.value) e.target.value = safeValue;
      });
    }
  }
});