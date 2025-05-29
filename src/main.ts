const midiOutSelect = document.getElementById('midiOutSelect') as HTMLSelectElement;
const startSecondsInput = document.getElementById('startSeconds') as HTMLInputElement;
const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;

let midiAccess: MIDIAccess | null = null;
let midiOut: MIDIOutput | null = null;
let running = false;
let timerId: number | null = null;
let startTime = 0;

const FPS = 30; // 30fps
const QF_INTERVAL = 1000 / (FPS * 4); // クォータフレームごとに送信

// MTCクォータフレームメッセージ生成
function getQuarterFrameMessages(hours: number, minutes: number, seconds: number, frames: number) {
  // SMPTE type of 30fps NDF: 0x03
  const type = 0x03;
  return [
    [0xF1, 0x00 | (frames & 0x0F)], // QF0
    [0xF1, 0x10 | ((frames >> 4) & 0x01)], // QF1
    [0xF1, 0x20 | (seconds & 0x0F)], // QF2
    [0xF1, 0x30 | ((seconds >> 4) & 0x03)], // QF3
    [0xF1, 0x40 | (minutes & 0x0F)], // QF4
    [0xF1, 0x50 | (minutes >> 4) & 0x03], // QF5
    [0xF1, 0x60 | (hours & 0x0F)], // QF6
    [0xF1, 0x70 | (type << 1) | ((hours >> 4) & 0x01)], // QF7
  ];
}

// タイムコードをフレーム数から分解
function framesToTimecode(totalFrames: number) {
  const frames = totalFrames % FPS;
  const totalSeconds = Math.floor(totalFrames / FPS);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60) % 24;
  return { hours, minutes, seconds, frames };
}

function sendQuarterFrame() {
  if (!midiOut) return;
  const now = performance.now();
  const elapsed = (now - startTime) / 1000;
  const totalFrames = Math.floor(Number(startSecondsInput.value) * FPS + elapsed * FPS);
  const { hours, minutes, seconds, frames } = framesToTimecode(totalFrames);
  // メッセージを順に送信
  const qfMsgs = getQuarterFrameMessages(hours, minutes, seconds, frames);
  qfMsgs.forEach((msg, index) => {
    midiOut?.send(msg, now + index * QF_INTERVAL);
  });
  timerId = window.setTimeout(sendQuarterFrame, QF_INTERVAL * 8);
}

toggleBtn.onclick = () => {
  if (!running) {
    if (!midiOut) {
      alert('MIDI出力先を選択してください');
      return;
    }
    running = true;
    toggleBtn.textContent = '送信停止';
    startTime = performance.now();
    sendQuarterFrame();
  } else {
    running = false;
    toggleBtn.textContent = '送信開始';
    if (timerId) clearTimeout(timerId);
  }
};

midiOutSelect.onchange = () => {
  const id = midiOutSelect.value;
  midiOut = midiAccess?.outputs.get(id) || null;
};

navigator.requestMIDIAccess().then(access => {
  midiAccess = access;
  midiOutSelect.innerHTML = '';
  for (const output of access.outputs.values()) {
    const opt = document.createElement('option');
    opt.value = output.id;
    opt.textContent = output.name || output.id;
    midiOutSelect.appendChild(opt);
  }
  if (access.outputs.size > 0) {
    midiOutSelect.selectedIndex = 0;
    midiOut = access.outputs.values().next()?.value || null;
  }
});