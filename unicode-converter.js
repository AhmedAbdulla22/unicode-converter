// ─── Theme Toggle ───────────────────────────────────────────────
const toggleSwitch = document.getElementById('slider');

(function () {
    if (localStorage.getItem('AktoUTheme') === 'Dark') {
        if (toggleSwitch) toggleSwitch.checked = true;
        document.documentElement.setAttribute('theme', 'dark');
    }
})();

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        if (toggleSwitch) toggleSwitch.click();
        event.preventDefault();
    }
});

if (toggleSwitch) {
    toggleSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('theme', 'dark');
            localStorage.setItem('AktoUTheme', 'Dark');
        } else {
            document.documentElement.setAttribute('theme', 'light');
            localStorage.setItem('AktoUTheme', 'light');
        }
    });
}

// ─── Conversion ──────────────────────────────────────────────────
const unicodeTA = document.getElementById('unicodeTA');
const alikTA    = document.getElementById('alikTA');
const inpEve    = new Event('input');

// Mappings: order matters — longer/multi-char entries must come first
const mappings = [
    // Numbers
    ['٠','0'],['١','1'],['٢','2'],['٣','3'],['٤','4'],
    ['٥','5'],['٦','6'],['٧','7'],['٨','8'],['٩','9'],
    ['٪','%'],

    // Multi-char combos first
    ['ڵا','لآ'],

    // Kurdish-specific single chars
    ['چ','ض'],
    ['پ','ث'],
    ['ڤ','ظ'],
    ['ژ','ذ'],
    ['ۆ','ؤ'],
    ['ڵ','لَ'],
    ['ڕ','رِ'],
    ['ێ','يَ'],
    ['ە', 'ة'],   // Standard Kurdish Heh (U+06D5)
    ['ک','ك'],
    ['گ','ط'],
    ['ی','ي'],
    ['ء','ْ'],
];

function convertUnicodeToAlik(text) {
    if (!text) return '';
    
    // 1. Context Fix: Convert Arabic 'ه' to 'ة' only when it's acting like a Kurdish 'ە'
    // (e.g., at the end of a word or before spaces/punctuation)
    // This protects words starting with 'ه' like هيجریدا
    // Updated with native RTL punctuation: ، ؟ ؛ :
    text = text.replace(/ه(?=\s|[\-\\/\)\(\[\]\{\},\.\?!؛،؟:]|$)/g, 'ە');

    let result = '';
    let i = 0;

    while (i < text.length) {
        let matched = false;

        // Try multi-char matches first
        for (const [uni, alik] of mappings) {
            if (uni.length > 1 && text.startsWith(uni, i)) {
                result += alik;
                i += uni.length;
                matched = true;
                break;
            }
        }

        // Then single char
        if (!matched) {
            for (const [uni, alik] of mappings) {
                if (uni.length === 1 && text[i] === uni) {
                    result += alik;
                    i++;
                    matched = true;
                    break;
                }
            }
        }

        // No match — keep original
        if (!matched) {
            result += text[i];
            i++;
        }
    }

    return result;
}

unicodeTA.addEventListener('input', () => {
    alikTA.value = convertUnicodeToAlik(unicodeTA.value);
    updateStats();
});

function updateStats() {
    const inStats  = document.getElementById('inputStats');
    const outStats = document.getElementById('outputStats');
    if (inStats)  inStats.textContent  = unicodeTA.value.length + ' characters';
    if (outStats) outStats.textContent = alikTA.value.length    + ' characters';
}

// ─── Copy & Clear ────────────────────────────────────────────────
function copyOutput() {
    if (!alikTA.value) return;
    navigator.clipboard.writeText(alikTA.value).then(() => showToast('تم النسخ ✓'));
}

function clearAll() {
    unicodeTA.value = '';
    alikTA.value    = '';
    updateStats();
}

// Triple-click to copy
[unicodeTA, alikTA].forEach((el) => {
    el.addEventListener('click', (e) => {
        if (e.detail === 3 && e.target.value !== '') {
            navigator.clipboard.writeText(e.target.value).then(() => showToast('تم النسخ ✓'));
        }
    });
});

// ─── Toast (no Toastify dependency) ──────────────────────────────
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}

// ─── Drag & Drop ─────────────────────────────────────────────────
[unicodeTA, alikTA].forEach((el) => {
    el.addEventListener('dragover', (e) => {
        el.setAttribute('drop-active', 'true');
        e.preventDefault();
    });

    el.addEventListener('dragleave', () => {
        el.setAttribute('drop-active', 'false');
    });

    el.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        showLoadingOverlay();

        if (ev.dataTransfer.items.length > 1) {
            showToast('Can not read more than 1 file at a time');
            hideLoadingOverlay();
            return;
        }

        try {
            const file = ev.dataTransfer.items[0];
            if (file && file.kind === 'file') await handleFile(file, el);
        } catch (error) {
            showToast('Error handling file!');
            console.error(error);
        }

        el.setAttribute('drop-active', 'false');
        hideLoadingOverlay();
    });
});

async function handleFile(file, el) {
    file = file.getAsFile();
    const exts = ['doc','docx','xls','xlsx','ppt','pptx','pdf'];
    const ext  = file.name.split('.').pop();

    if (file.size / 1024 / 1024 > 500) {
        showToast('File cannot be larger than 500MB');
    } else if (ext === 'txt') {
        el.value = await readTxtFile(file);
        el.dispatchEvent(inpEve);
    } else if (exts.includes(ext)) {
        el.value = await extractTextFromFile(file, ext);
        el.dispatchEvent(inpEve);
    } else {
        showToast(`'.${ext}' filetype cannot be converted`);
    }
}

function readTxtFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function extractTextFromFile(file, ext) {
    return new Promise((resolve, reject) => {
        const docToText = new DocToText();
        docToText.extractToText(file, ext)
            .then((text) => resolve(processExtractedText(text)))
            .catch(reject);
    });
}

function processExtractedText(text) {
    const lines = text.replace(/^\n+/, '').trim().split(/\n/);
    const clean = lines
        .filter(l => l !== ',')
        .map(l => l.replace(/,/g, ''));
    return clean.join('\n').replace(/(.)\n\n/g, '$1\n');
}

// ─── Loading overlay ─────────────────────────────────────────────
function showLoadingOverlay() {
    const el = document.querySelector('.loading-overlay');
    if (el) el.style.display = 'block';
}
function hideLoadingOverlay() {
    const el = document.querySelector('.loading-overlay');
    if (el) el.style.display = 'none';
}