const BITS = '01';

function pulse(scopeId, value) {
    const el = document.getElementById(scopeId);
    if (!value) { el.textContent = '— — — —'; return; }
    let out = '';
    for (let i = 0; i < value.length && out.length < 24; i++) {
        out += value.charCodeAt(i) % 2 === 0 ? '0' : '1';
    }
    el.textContent = out.match(/.{1,4}/g)?.join(' ') || '—';
}

function setOutput(outId, text, isWarn) {
    const el = document.getElementById(outId);
    el.textContent = text;
    el.classList.remove('empty', 'warn');
    if (isWarn) el.classList.add('warn');
}

function setMode(modeId, text) {
    document.getElementById(modeId).textContent = text;
}

function isAllBinary(s) {
    return /^[01\s]+$/.test(s);
}

function decodeBinaryToText(compact) {
    const bytes = compact.match(/.{1,8}/g) || [];
    return bytes.map(b => String.fromCharCode(parseInt(b, 2))).join('');
}

/* ---------------- Channel 1: text <-> binary ---------------- */
function runTextBinary() {
    const raw = document.getElementById('textIn').value.trim();
    if (!raw) {
        setOutput('textOut', 'Type something into the field above first.', true);
        setMode('textMode', '');
        return;
    }
    const compact = raw.replace(/\s+/g, '');
    if (isAllBinary(raw) && compact.length % 8 === 0) {
        try {
            const decoded = decodeBinaryToText(compact);
            setOutput('textOut', decoded, false);
            setMode('textMode', 'binary → text');
        } catch (e) {
            setOutput('textOut', 'That binary has bytes outside normal range.', true);
            setMode('textMode', 'error');
        }
        return;
    }
    const binary = Array.from(raw).map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    setOutput('textOut', binary, false);
    setMode('textMode', 'text → binary');
}

/* ---------------- Channel 2: number <-> binary ---------------- */
function runNumberBinary() {
    const raw = document.getElementById('numIn').value.trim();
    if (!raw) {
        setOutput('numOut', 'Type a number or binary digits above first.', true);
        setMode('numMode', '');
        return;
    }
    if (/^[01]+$/.test(raw)) {
        const decimal = parseInt(raw, 2);
        setOutput('numOut', decimal.toString(), false);
        setMode('numMode', 'binary → number');
        return;
    }
    if (/^\d+$/.test(raw)) {
        setOutput('numOut', Number(raw).toString(2), false);
        setMode('numMode', 'number → binary');
        return;
    }
    setOutput('numOut', 'Use digits only — a plain number or 0s and 1s.', true);
    setMode('numMode', 'error');
}

/* ---------------- Channel 3: auto-detect ---------------- */
function runAuto() {
    const raw = document.getElementById('autoIn').value.trim();
    if (!raw) {
        setOutput('autoOut', 'Paste text, a number, or binary above first.', true);
        setMode('autoMode', '');
        return;
    }

    if (/^\d+$/.test(raw) && !/^[01]+$/.test(raw)) {
        setOutput('autoOut', Number(raw).toString(2), false);
        setMode('autoMode', 'number → binary');
        return;
    }

    if (isAllBinary(raw)) {
        const compact = raw.replace(/\s+/g, '');
        if (compact.length % 8 === 0) {
            try {
                const decoded = decodeBinaryToText(compact);
                setOutput('autoOut', decoded, false);
                setMode('autoMode', 'binary → text');
            } catch (e) {
                setOutput('autoOut', 'Those bytes do not decode cleanly.', true);
                setMode('autoMode', 'error');
            }
        } else {
            const decimal = parseInt(compact, 2);
            setOutput('autoOut', decimal.toString(), false);
            setMode('autoMode', 'binary → number');
        }
        return;
    }

    const binary = Array.from(raw).map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    setOutput('autoOut', binary, false);
    setMode('autoMode', 'text → binary');
}

/* ---------------- Channel 4: earth <-> alien ---------------- */
// Layer 1: exact phrases as given — these always decode perfectly.
const ALIEN_DICT = [
    ["i don't know", "zab zup"],
    ["i dont know", "zab zup"],
    ["i want", "zap"],
    ["love you", "zib zub zab"],
    ["hello", "zap zup"],
    ["skibidi", "zibzidi"],
    ["good morning", "zeb zab zib"],
    ["goodnight", "zeb zab zab"],
    ["good night", "zeb zab zab"],
    ["good", "zap zub"],
    ["same", "zab zab"],
    ["okay", "blab"],
    ["ok", "blab"],
    ["yes", "blob"],
    ["no", "bleb bleb"],
    ["can", "zob zep"],
    ["friend", "vip vop"],
    ["fuck you", "zib zob"]
].sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);

// reverse lookup: alien phrase -> english. keep first english phrasing
// per unique alien value, sorted longest (in alien word count) first
// so greedy matching prefers full known phrases over partial ones.
const seenAlienValues = new Set();
const ALIEN_TO_EARTH = [];
ALIEN_DICT.forEach(([eng, alien]) => {
    if (seenAlienValues.has(alien)) return;
    seenAlienValues.add(alien);
    ALIEN_TO_EARTH.push([alien, eng]);
});
ALIEN_TO_EARTH.sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);

// Layer 2: per-syllable grammar, worked out from how each alien word
// recurs across the phrases above. Not every guess is certain (zab and
// zib each show up in more than one role) but every alien word maps to
// something, so any combination can be decoded — not just the 18
// phrases above.
const MORPHEME_A2E = {
    zap: 'want',
    zup: 'hey',
    zab: 'know',
    zib: 'you',
    zub: 'love',
    zeb: 'good',
    zob: 'fuck',
    zep: 'can',
    blab: 'okay',
    bleb: 'no',
    vip: 'friend',
    vop: 'friend',
    zibzidi: 'skibidi',
    yes: 'blob'
};

// reverse the morphemes for english -> alien fallback (first alien
// word claimed for a given english concept wins)
const MORPHEME_E2A = {};
Object.entries(MORPHEME_A2E).forEach(([alien, eng]) => {
    if (!(eng in MORPHEME_E2A)) MORPHEME_E2A[eng] = alien;
});

// Layer 3: a fixed alien alphabet, baked into the page itself —
// not saved per-browser. Any word with no phrase or morpheme gets
// spelled out letter by letter, using syllables hyphenated together
// so it's unambiguous to read back. Because this table is the same
// for every copy of this file, it works identically for anyone you
// send the page to — no shared memory required.
const ALPHABET_E2A = {
    a: 'za', b: 'bla', c: 'ko', d: 'dro', e: 'ze',
    f: 'fen', g: 'gra', h: 'hu', i: 'zi', j: 'jor',
    k: 'kel', l: 'lix', m: 'mu', n: 'nys', o: 'zo',
    p: 'pix', q: 'qua', r: 'rok', s: 'sev', t: 'tev',
    u: 'vu', v: 'vi', w: 'wex', x: 'xol', y: 'yip',
    z: 'zub'
};
const ALPHABET_A2E = {};
Object.entries(ALPHABET_E2A).forEach(([letter, syll]) => { ALPHABET_A2E[syll] = letter; });

function spellToAlien(word) {
    return word.split('').map(ch => ALPHABET_E2A[ch] || '').filter(Boolean).join('-');
}

function spellToEarth(alienWord) {
    // a spelled word looks like "hu-ze-lix-lix-zo" (hyphenated syllables)
    const syll = alienWord.split('-');
    const letters = syll.map(s => ALPHABET_A2E[s]);
    if (letters.some(l => !l)) return null; // not a valid spelled word
    return letters.join('');
}

let alienDirection = 'toAlien';

function setAlienDirection(dir) {
    alienDirection = dir;
    document.querySelectorAll('#alienDirToggle .dir-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.dir === dir);
    });
    const input = document.getElementById('alienIn');
    const label = document.getElementById('alienInLabel');
    if (dir === 'toAlien') {
        label.textContent = 'English word or sentence';
        input.placeholder = "i don't know if you love me";
    } else {
        label.textContent = 'Alien word or sentence';
        input.placeholder = 'zab zup zib zub zab';
    }
    clearPanel('alienIn', 'alienOut', 'alienMode', 'scope4');
}

function translateToAlien(raw) {
    let text = raw.toLowerCase();
    const usedPhrases = new Set();

    // Layer 1: exact phrases first (longest first)
    ALIEN_DICT.forEach(([phrase, alien]) => {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('\\b' + escaped.replace(/ /g, '\\s+') + '\\b', 'g');
        if (re.test(text)) usedPhrases.add(phrase);
        text = text.replace(re, () => '§' + alien.replace(/ /g, '·') + '§');
    });

    const tokens = text.split(/(\s+|[.,!?;:])/);
    let spelledCount = 0;
    const result = tokens.map(tok => {
        if (!tok || /^\s+$/.test(tok) || /^[.,!?;:]$/.test(tok)) return tok;
        if (tok.startsWith('§')) {
            return tok.replace(/§/g, '').replace(/·/g, ' ');
        }
        const clean = tok.replace(/[^a-z']/g, '');
        if (!clean) return tok;
        // Layer 2: known morpheme
        if (MORPHEME_E2A[clean]) return MORPHEME_E2A[clean];
        // Layer 3: spell it out with the fixed alphabet
        spelledCount++;
        return spellToAlien(clean);
    });

    return { translated: result.join(''), used: Array.from(usedPhrases), spelled: spelledCount };
}

function translateToEarth(raw) {
    const text = raw.toLowerCase();
    const rawTokens = text.split(/(\s+|[.,!?;:])/).filter(t => t !== '');

    const items = rawTokens.map(t => {
        if (/^\s+$/.test(t) || /^[.,!?;:]$/.test(t)) return { type: 'sep', value: t };
        return { type: 'word', value: t.replace(/[^a-z'-]/g, '') };
    }).filter(it => it.type === 'sep' || it.value.length > 0);

    const words = items.filter(it => it.type === 'word').map(it => it.value);

    const usedPhrases = new Set();
    const guessedMorphemes = [];
    const spelledWords = [];
    const unknownWords = [];
    const outWords = [];

    let i = 0;
    while (i < words.length) {
        let matched = false;

        // Layer 1: exact known phrase, longest alien-word-count first
        // (skip hyphenated tokens here — those are spelled words, not phrase words)
        if (!words[i].includes('-')) {
            for (const [alienPhrase, eng] of ALIEN_TO_EARTH) {
                const alienWords = alienPhrase.split(' ');
                if (alienWords.length > words.length - i) continue;
                let ok = true;
                for (let k = 0; k < alienWords.length; k++) {
                    if (words[i + k] !== alienWords[k]) { ok = false; break; }
                }
                if (ok) {
                    outWords.push(eng);
                    usedPhrases.add(alienPhrase);
                    i += alienWords.length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
        }

        // Layer 2: per-word morpheme (only for non-hyphenated tokens)
        const w = words[i];
        if (!w.includes('-') && MORPHEME_A2E[w]) {
            outWords.push(MORPHEME_A2E[w]);
            guessedMorphemes.push(w);
            i += 1;
            continue;
        }

        // Layer 3: a word spelled out with the fixed alphabet
        const spelled = spellToEarth(w);
        if (spelled) {
            outWords.push(spelled);
            spelledWords.push(w);
        } else {
            // not a phrase, not a morpheme, not valid spelling — truly unknown
            outWords.push(w);
            unknownWords.push(w);
        }
        i += 1;
    }

    return {
        translated: outWords.join(' '),
        used: Array.from(usedPhrases),
        guessed: guessedMorphemes,
        spelled: spelledWords,
        unknown: unknownWords
    };
}

function runAlien() {
    const raw = document.getElementById('alienIn').value.trim();
    if (!raw) {
        const hint = alienDirection === 'toAlien' ? 'Type some English above first.' : 'Type some alien words above first.';
        setOutput('alienOut', hint, true);
        setMode('alienMode', '');
        return;
    }

    if (alienDirection === 'toAlien') {
        const { translated, used, spelled } = translateToAlien(raw);
        setOutput('alienOut', translated, false);
        const parts = [];
        if (used.length) parts.push(`${used.length} known phrase${used.length > 1 ? 's' : ''}`);
        if (spelled) parts.push(`${spelled} word${spelled > 1 ? 's' : ''} spelled out`);
        setMode('alienMode', parts.length ? `english → alien · ${parts.join(' + ')}` : 'english → alien');
    } else {
        const { translated, used, guessed, spelled, unknown } = translateToEarth(raw);
        setOutput('alienOut', translated, false);
        const parts = [];
        if (used.length) parts.push(`${used.length} known phrase${used.length > 1 ? 's' : ''}`);
        if (guessed.length) parts.push(`${guessed.length} from grammar`);
        if (spelled.length) parts.push(`${spelled.length} spelled out`);
        if (unknown.length) parts.push(`${unknown.length} not valid alien`);
        setMode('alienMode', parts.length ? `alien → english · ${parts.join(' + ')}` : 'alien → english');
    }
}

function populateAlienLegend() {
    const grid = document.getElementById('alienLegend');
    if (!grid) return;
    const sorted = [...ALIEN_DICT].sort((a, b) => a[0].localeCompare(b[0]));
    grid.innerHTML = sorted.map(([e, a]) => `<span class="e">${e}</span><span class="a">${a}</span>`).join('');
}
populateAlienLegend();

function clearPanel(inputId, outId, modeId, scopeId) {
    document.getElementById(inputId).value = '';
    document.getElementById(outId).textContent = 'Result appears here';
    document.getElementById(outId).classList.add('empty');
    document.getElementById(outId).classList.remove('warn');
    document.getElementById(modeId).textContent = '';
    document.getElementById(scopeId).textContent = '— — — —';
    document.getElementById(inputId).focus();
}

function copyFrom(outId) {
    const el = document.getElementById(outId);
    const text = el.innerText || el.textContent || '';
    if (!text || el.classList.contains('empty')) { return; }

    const btn = [...document.querySelectorAll('.copy-btn')].find(b => b.getAttribute('onclick').includes(outId));

    const done = () => {
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = 'copied';
        setTimeout(() => btn.textContent = orig, 1100);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { }
    document.body.removeChild(ta);
}