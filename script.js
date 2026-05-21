const stringsContainer = document.getElementById("strings-container");
const stringCountSelect = document.getElementById("string-count");
const volumeSlider = document.getElementById("volume");
const resetAllBtn = document.getElementById("reset-all-btn");

const STORAGE_KEY = "guitarTunerSettings";

const STANDARD_TUNINGS = {
  6: ["E2", "A2", "D3", "G3", "B3", "E4"],
  7: ["B1", "E2", "A2", "D3", "G3", "B3", "E4"],
  8: ["F♯1", "B1", "E2", "A2", "D3", "G3", "B3", "E4"]
};

const NOTES = [
  "C","C♯","D","D♯","E","F",
  "F♯","G","G♯","A","A♯","B"
];

const NOTE_LABELS = {
  "C": "C",
  "C♯": "C♯/D♭",
  "D": "D",
  "D♯": "D♯/E♭",
  "E": "E",
  "F": "F",
  "F♯": "F♯/G♭",
  "G": "G",
  "G♯": "G♯/A♭",
  "A": "A",
  "A♯": "A♯/B♭",
  "B": "B"
};

let audioContext;
let oscillators = [];
let gainNode = null;
let activeToggle = null;

function initializeAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function noteToMidi(note) {
  const match = note.match(/^([A-G]♯?)(\d)$/);

  if (!match) return 60;

  const pitch = match[1];
  const octave = parseInt(match[2]);

  return NOTES.indexOf(pitch) + ((octave + 1) * 12);
}

function midiToNote(midi) {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;

  return `${NOTES[noteIndex]}${octave}`;
}

function noteToFrequency(note) {
  const midi = noteToMidi(note);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createNoteOptions(baseNote) {
  const baseMidi = noteToMidi(baseNote);
  const options = [];

  for (let i = -11; i <= 11; i++) {
    const midi = baseMidi + i;
    const note = midiToNote(midi);

    const match = note.match(/^([A-G]♯?)(\d)$/);
    const pitch = match[1];
    const octave = match[2];

    options.push({
      value: note,
      label: `${NOTE_LABELS[pitch]}${octave}`
    });
  }

  return options;
}

function stopTone() {

  if (!audioContext || !gainNode || oscillators.length === 0) {

    document.querySelectorAll(".tone-toggle").forEach(toggle => {
      toggle.checked = false;
    });

    document.querySelectorAll(".string-row").forEach(row => {
      row.classList.remove("active");
    });

    return;
  }

  const now = audioContext.currentTime;

  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);

  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.12
  );

  setTimeout(() => {

    oscillators.forEach(osc => {
      osc.stop();
      osc.disconnect();
    });

    gainNode.disconnect();

    oscillators = [];
    gainNode = null;

  }, 150);

  document.querySelectorAll(".tone-toggle").forEach(toggle => {
    toggle.checked = false;
  });

  document.querySelectorAll(".string-row").forEach(row => {
    row.classList.remove("active");
  });

  activeToggle = null;
}

function playTone(note, toggleElement, rowElement) {

  initializeAudio();

  const HARMONIC_BOOST = 1.0;
  const LOW_NOTE_THRESHOLD = 120;

  const frequency = noteToFrequency(note);

  gainNode = audioContext.createGain();

  gainNode.gain.setValueAtTime(
    0.0001,
    audioContext.currentTime
  );

  gainNode.connect(audioContext.destination);

  /*
    Increase harmonic content for low notes
  */
  let boost = 1;

  if (frequency < LOW_NOTE_THRESHOLD) {

    boost =
      1 +
      (
        (LOW_NOTE_THRESHOLD - frequency)
        / LOW_NOTE_THRESHOLD
      ) * HARMONIC_BOOST;

  }

  /*
    Fundamental
  */
  const osc1 = audioContext.createOscillator();
  const gain1 = audioContext.createGain();

  osc1.type = "sine";
  osc1.frequency.value = frequency;
  gain1.gain.value = 1.0;

  osc1.connect(gain1);
  gain1.connect(gainNode);

  /*
    2nd harmonic
  */
  const osc2 = audioContext.createOscillator();
  const gain2 = audioContext.createGain();

  osc2.type = "sine";
  osc2.frequency.value = frequency * 2;
  gain2.gain.value = 0.35 * boost;

  osc2.connect(gain2);
  gain2.connect(gainNode);

  /*
    3rd harmonic
  */
  const osc3 = audioContext.createOscillator();
  const gain3 = audioContext.createGain();

  osc3.type = "sine";
  osc3.frequency.value = frequency * 3;
  gain3.gain.value = 0.2 * boost;

  osc3.connect(gain3);
  gain3.connect(gainNode);

  /*
    4th harmonic
  */
  const osc4 = audioContext.createOscillator();
  const gain4 = audioContext.createGain();

  osc4.type = "sine";
  osc4.frequency.value = frequency * 4;
  gain4.gain.value = 0.1 * boost;

  osc4.connect(gain4);
  gain4.connect(gainNode);

  oscillators = [
    osc1,
    osc2,
    osc3,
    osc4
  ];

  oscillators.forEach(osc => osc.start());

  gainNode.gain.exponentialRampToValueAtTime(
    parseFloat(volumeSlider.value),
    audioContext.currentTime + 0.04
  );

  toggleElement.checked = true;
  rowElement.classList.add("active");

  activeToggle = toggleElement;
}

function saveSettings() {
  const rows = document.querySelectorAll(".string-row");

  const settings = {
    stringCount: stringCountSelect.value,
    volume: volumeSlider.value,
    notes: []
  };

  rows.forEach(row => {
    const select = row.querySelector(".note-select");
    settings.notes.push(select.value);
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {
      stringCount: 6,
      volume: 0.3,
      notes: STANDARD_TUNINGS[6]
    };
  }

  return JSON.parse(saved);
}

function renderStrings() {
  stopTone();

  stringsContainer.innerHTML = "";

  const count = parseInt(stringCountSelect.value);
  const defaults = STANDARD_TUNINGS[count];

  const saved = loadSettings();

  for (let i = 0; i < count; i++) {

    const row = document.createElement("div");
    row.className = "string-row";

    const currentNote =
      saved.notes && saved.notes[i]
        ? saved.notes[i]
        : defaults[i];

    const freq = noteToFrequency(currentNote).toFixed(2);

    const options = createNoteOptions(defaults[i]);

    row.innerHTML = `
      <div class="row-top">

        <select class="note-select">
          ${options.map(option => `
            <option
              value="${option.value}"
              ${option.value === currentNote ? "selected" : ""}
            >
              ${option.label}
            </option>
          `).join("")}
        </select>

        <div class="frequency">
          ${freq} Hz
        </div>

        <div class="row-controls">

          <label class="toggle">
            <input type="checkbox" class="tone-toggle">
            <span class="slider"></span>
          </label>

        </div>

      </div>
    `;

    const select = row.querySelector(".note-select");
    const frequencyLabel = row.querySelector(".frequency");
    const toggle = row.querySelector(".tone-toggle");

    select.addEventListener("change", () => {

      const note = select.value;
      const freq = noteToFrequency(note).toFixed(2);

      frequencyLabel.textContent = `${freq} Hz`;

      if (toggle.checked) {
        playTone(note, toggle, row);
      }

      saveSettings();
    });

    toggle.addEventListener("change", () => {

    if (toggle.checked) {

        /*
        Turn off all other toggles
        */
        document.querySelectorAll(".tone-toggle").forEach(otherToggle => {

        if (otherToggle !== toggle) {
            otherToggle.checked = false;
        }

        });

        /*
        Remove active state from rows
        */
        document.querySelectorAll(".string-row").forEach(otherRow => {
        otherRow.classList.remove("active");
        });

        /*
        If existing tone exists,
        fade it out FIRST,
        THEN start new tone
        */
        if (audioContext && gainNode && oscillators.length > 0) {

        const oldOscillators = [...oscillators];
        const oldGain = gainNode;

        const now = audioContext.currentTime;

        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);

        oldGain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.08
        );

        oscillators = [];
        gainNode = null;

        setTimeout(() => {

            oldOscillators.forEach(osc => {
            osc.stop();
            osc.disconnect();
            });

            oldGain.disconnect();

        }, 100);

        }

        playTone(select.value, toggle, row);

    } else {

        stopTone();

    }

    });

    stringsContainer.appendChild(row);
  }

  saveSettings();
}

function resetAllStrings() {

  const count =
    parseInt(stringCountSelect.value);

  const defaults =
    STANDARD_TUNINGS[count];

  document
    .querySelectorAll(".string-row")
    .forEach((row, index) => {

      const select =
        row.querySelector(".note-select");

      const frequency =
        row.querySelector(".frequency");

      select.value = defaults[index];

      frequency.textContent =
        `${noteToFrequency(defaults[index]).toFixed(2)} Hz`;

    });

  stopTone();

  saveSettings();
}

stringCountSelect.addEventListener(
  "change",
  () => {

    const count =
      parseInt(stringCountSelect.value);

    const settings =
      loadSettings();

    settings.stringCount = count;
    settings.notes =
      [...STANDARD_TUNINGS[count]];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );

    renderStrings();
  }
);

volumeSlider.addEventListener("input", () => {

  if (gainNode) {
    gainNode.gain.linearRampToValueAtTime(
      parseFloat(volumeSlider.value),
      audioContext.currentTime + 0.02
    );
  }

  saveSettings();
});

resetAllBtn.addEventListener(
  "click",
  resetAllStrings
);

function initialize() {

  const saved = loadSettings();

  stringCountSelect.value = saved.stringCount || 6;
  volumeSlider.value = saved.volume || 0.3;

  renderStrings();
}

initialize();