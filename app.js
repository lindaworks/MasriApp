/* ===========================================================
   MASRI MIT LINDA – VERSION B5.9
   Vollständige App-Logik
   - Automatisches Laden von ZIPs über Cloudflare Proxy
   - Text/Audio Matching
   - Lektions-Startpunkte
   - Learning Cards
=========================================================== */

let cards = [];          // Alle Lernkarten
let index = 0;           // Aktuelle Karte
let audioMap = {};       // Mapping: Karte → Audio
let audioList = [];      // Liste aller Audios
let lessonStart = {};    // Startsatz pro Lektion

// Speichere UI Elemente
const elAr = document.getElementById("card-ar");
const elU = document.getElementById("card-u");
const elDe = document.getElementById("card-de");
const elAudio = document.getElementById("card-audio");

// Tabs aktivieren
document.querySelectorAll(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
    });
});

// Standard URLs setzen
const defaultTextURL  = "https://masriserver-proxy.masriserver-proxy.workers.dev/text";
const defaultAudioURL = "https://masriserver-proxy.masriserver-proxy.workers.dev/audio";

// ============================
// Einstellungen laden
// ============================

function loadSettings() {
    document.getElementById("cfg-url-text").value =
        localStorage.getItem("url-text") || defaultTextURL;

    document.getElementById("cfg-url-audio").value =
        localStorage.getItem("url-audio") || defaultAudioURL;

    lessonStart = JSON.parse(localStorage.getItem("lesson-start") || "{}");

    document.getElementById("cfg-l1").value = lessonStart["1"] || "";
    document.getElementById("cfg-l2").value = lessonStart["2"] || "";
    document.getElementById("cfg-l3").value = lessonStart["3"] || "";
    document.getElementById("cfg-l4").value = lessonStart["4"] || "";
}

loadSettings();

// ============================
// Einstellungen speichern
// ============================

document.getElementById("cfg-save").addEventListener("click", () => {
    localStorage.setItem("url-text",  document.getElementById("cfg-url-text").value);
    localStorage.setItem("url-audio", document.getElementById("cfg-url-audio").value);
    alert("Gespeichert ✔️");
});

document.getElementById("cfg-save-lessons").addEventListener("click", () => {
    const obj = {
        1: document.getElementById("cfg-l1").value,
        2: document.getElementById("cfg-l2").value,
        3: document.getElementById("cfg-l3").value,
        4: document.getElementById("cfg-l4").value
    };
    localStorage.setItem("lesson-start", JSON.stringify(obj));
    alert("Startpunkte gespeichert ✔️");
});


// ============================
// ZIP laden (Text + Audio)
// ============================

async function loadZip(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();

    const zip = await JSZip.loadAsync(buf);
    return zip;
}


// ============================
// TEXT ZIP verarbeiten
// ============================

async function parseTextZip(zip) {
    const firstFile = Object.keys(zip.files)[0];
    const raw = await zip.files[firstFile].async("string");

    const lines = raw.split(/\r?\n/);

    let out = [];

    for (let line of lines) {
        if (!line.trim()) continue;

        // Arabisch?
        let hasArabic = /[\u0600-\u06FF]/.test(line);

        // Drei Fälle:
        // 1. Arabisch + Lautschrift (3ä, ä, etc.)
        // 2. Deutsch
        // 3. Mischtext → ignorieren

        if (hasArabic) {
            // Arabische Zeile
            out.push({
                ar: line.trim(),
                u: "",
                de: ""
            });

        } else if (/[äÄöÖüÜ3]/.test(line)) {
            // Lautschrift
            if (out.length > 0) out[out.length - 1].u = line.trim();

        } else {
            // Deutsch
            if (out.length > 0) out[out.length - 1].de = line.trim();
        }
    }

    cards = out.filter(o => o.ar || o.u || o.de);
}


// ============================
// AUDIO ZIP verarbeiten
// ============================

async function parseAudioZip(zip) {
    audioList = [];

    const fileNames = Object.keys(zip.files);

    for (const f of fileNames) {
        if (f.endsWith(".opus") || f.endsWith(".mp3") || f.endsWith(".wav")) {
            audioList.push(f);
        }
    }

    // Einfaches Matching: gleicher Index
    audioMap = {};

    for (let i = 0; i < cards.length; i++) {
        if (audioList[i]) audioMap[i] = audioList[i];
    }

    // Dropdown füllen
    const list = document.getElementById("audio-list");
    list.innerHTML = "";
    audioList.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        list.appendChild(opt);
    });
}


// ============================
// Karte anzeigen
// ============================

function showCard() {
    if (!cards.length) return;

    const c = cards[index];

    elAr.textContent = c.ar || "–";
    elU.textContent  = c.u || "–";
    elDe.textContent = c.de || "–";

    if (audioMap[index] && audioZip) {
        audioZip.files[audioMap[index]]
            .async("blob")
            .then(blob => {
                elAudio.src = URL.createObjectURL(blob);
                elAudio.style.display = "block";
            });
    } else {
        elAudio.style.display = "none";
    }
}


// ============================
// Navigation
// ============================

document.getElementById("btn-next").onclick = () => {
    index = (index + 1) % cards.length;
    showCard();
};

document.getElementById("btn-prev").onclick = () => {
    index = (index - 1 + cards.length) % cards.length;
    showCard();
};

document.getElementById("btn-repeat").onclick = () => {
    showCard();
};

document.getElementById("btn-know").onclick = () => {
    alert("Super! ✔️");
};


// ============================
// AUDIO im Audio-Tab
// ============================

document.getElementById("audio-list").addEventListener("change", async e => {
    const file = e.target.value;
    if (!file || !audioZip) return;

    const blob = await audioZip.files[file].async("blob");
    document.getElementById("audio-tester").src = URL.createObjectURL(blob);
});


// ============================
// Übersicht
// ============================

function updateOverview() {
    let out = "";
    cards.forEach((c, i) => {
        out += `<b>${i + 1}.</b> AR: ${c.ar}<br>U: ${c.u}<br>DE: ${c.de}<hr>`;
    });
    document.getElementById("overview").innerHTML = out;
}


// ============================
// Alles laden
// ============================

let audioZip = null;

async function loadAll() {
    const urlText  = localStorage.getItem("url-text")  || defaultTextURL;
    const urlAudio = localStorage.getItem("url-audio") || defaultAudioURL;

    try {
        const zipText  = await loadZip(urlText);
        await parseTextZip(zipText);

        audioZip = await loadZip(urlAudio);
        await parseAudioZip(audioZip);

        updateOverview();
        showCard();
    } catch (e) {
        alert("Fehler beim Laden:\n" + e);
    }
}

loadAll();