// ============================================================
//  BALCÃO TECH — motor.js  (refatorado por dev sênior)
//  Arquitetura: máquina de estados com scroll hijacking controlado
// ============================================================

// --- MATRIX CANVAS ---
const canvas = document.getElementById('matrix-canvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const letters  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
const fontSize = 16;
let drops      = [];

function initDrops() {
    const columns = Math.floor(canvas.width / fontSize);
    drops = Array(columns).fill(1);
}
initDrops();
window.addEventListener('resize', initDrops);

const colors = ['#ffb7ce', '#c1e1c1', '#b2e2f2', '#dec4ef'];

function drawMatrix() {
    ctx.fillStyle = "rgba(253, 251, 253, 0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontSize + "px monospace";
    for (let i = 0; i < drops.length; i++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillText(letters[Math.floor(Math.random() * letters.length)], i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}
setInterval(drawMatrix, 50);


// ============================================================
//  MÁQUINA DE ESTADOS
//  Estado 0 → mascote visível, camada fechada
//  Estado 1,2,3 → frases com scroll hijack
//  Estado 4 → bloco relaxa + libera scroll para os cards
// ============================================================

const TOTAL_ESTADOS    = 4;
const COOLDOWN_MS      = 1100; // tempo bloqueado entre transições
const CORES_FUNDO      = ["#ffeadb", "#dec4ef", "#f0e8ff", "#eef9ff"];

let estado       = 0;
let emCooldown   = false;
let modoCards    = false; // true quando o scroll nativo assumiu o controle

// ---- referências DOM ----
const camada      = document.querySelector('.camada-revelada');
const mascote     = document.querySelector('.bloco-central-total');
const blocoFinal  = document.getElementById('bloco-relax-imersao');
const universo    = document.getElementById('universo-jornal');
const matrixEl    = document.getElementById('matrix-canvas');
const frases      = document.querySelectorAll('.frase-container');
const secaoCards  = document.getElementById('secao-cards-estudo');


// ============================================================
//  FUNÇÕES DE TRANSIÇÃO
// ============================================================

function mostrarFrase(num) {
    frases.forEach(f => f.classList.remove('ativa'));
    const alvo = document.getElementById(`f${num}`);
    if (alvo) alvo.classList.add('ativa');
}

function aplicarEstado() {
    // Garante que a página sempre começa do topo nos estados 0-3
    if (!modoCards) window.scrollTo({ top: 0 });

    // ---------- ESTADO 0: mascote ----------
    if (estado === 0) {
        camada.classList.remove('ativa');
        camada.style.opacity = '';
        mascote.style.opacity = '1';
        matrixEl.style.opacity = '0.8';
        blocoFinal.style.opacity = '0';
        // aguarda o fade-out antes de display:none
        setTimeout(() => {
            if (estado === 0) blocoFinal.style.display = 'none';
        }, 300);
        universo.style.backgroundColor = '';
        frases.forEach(f => f.classList.remove('ativa'));
        return;
    }

    // ---------- ESTADOS 1-3: frases ----------
    if (estado >= 1 && estado <= 3) {
        modoCards = false;
        document.body.style.overflowY = 'hidden';

        camada.classList.add('ativa');
        camada.style.opacity = '1';
        mascote.style.opacity = '0';
        matrixEl.style.opacity = '0.8';
        universo.style.backgroundColor = CORES_FUNDO[estado - 1];

        blocoFinal.style.opacity = '0';
        setTimeout(() => {
            if (estado <= 3) blocoFinal.style.display = 'none';
        }, 300);

        mostrarFrase(estado);
        return;
    }

    // ---------- ESTADO 4: bloco relaxa + libera cards ----------
    if (estado === 4) {
        modoCards = true;

        // Primeiro zera o scroll ANTES de liberar overflow
        window.scrollTo({ top: 0 });

        // Fade-out da camada e matrix
        camada.style.transition  = 'opacity 0.8s ease, clip-path 5.2s cubic-bezier(0.65, 0, 0.35, 1)';
        camada.style.opacity     = '0';
        matrixEl.style.opacity   = '0';
        universo.style.backgroundColor = '#ffffff';

        // Mostra bloco final com fade
        blocoFinal.style.display  = 'flex';
        blocoFinal.style.opacity  = '0';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                blocoFinal.style.transition = 'opacity 1s ease';
                blocoFinal.style.opacity    = '1';
            });
        });

        // Só libera o scroll após a animação para evitar jump
        setTimeout(() => {
            document.body.style.overflowY = 'auto';
        }, 900);
    }
}

function avancarEstado(direcao) {
    if (emCooldown) return;

    const novoEstado = estado + direcao;

    if (novoEstado < 0 || novoEstado > TOTAL_ESTADOS) return;

    estado = novoEstado;
    emCooldown = true;
    aplicarEstado();

    setTimeout(() => { emCooldown = false; }, COOLDOWN_MS);
}


// ============================================================
//  CAPTURA DE SCROLL — wheel + touch
// ============================================================

// --- Wheel (mouse / trackpad) ---
window.addEventListener('wheel', (e) => {

    // Modo cards: scroll nativo funcionando
    if (modoCards) {
        // Só intercepta se quiser voltar para o estado 3
        // (usuário fez scroll para o topo E tenta subir mais)
        if (e.deltaY < 0 && window.scrollY <= 2) {
            e.preventDefault();
            document.body.style.overflowY = 'hidden';
            modoCards = false;
            estado = 3;
            emCooldown = false;
            aplicarEstado();
            // reativa cooldown para não disparar duplo
            emCooldown = true;
            setTimeout(() => { emCooldown = false; }, COOLDOWN_MS);
        }
        return; // para tudo mais, o navegador cuida
    }

    // Modo hijack (estados 0-3)
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    avancarEstado(dir);

}, { passive: false });


// --- Touch (mobile) ---
let touchStartY = 0;
let touchMoved  = false;

window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchMoved  = false;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (modoCards) return; // deixa o navegador rolar livremente
    e.preventDefault();
    touchMoved = true;
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (modoCards) return;
    if (!touchMoved) return;

    const delta = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(delta) < 30) return; // ignora swipes muito curtos

    const dir = delta > 0 ? 1 : -1;
    avancarEstado(dir);
}, { passive: true });


// ============================================================
//  TECLADO (bônus de acessibilidade)
// ============================================================
window.addEventListener('keydown', (e) => {
    if (modoCards) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') avancarEstado(1);
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   avancarEstado(-1);
});


// ============================================================
//  ESTADO INICIAL
// ============================================================
document.body.style.overflowY = 'hidden';
aplicarEstado();