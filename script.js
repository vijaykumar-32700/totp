const SECRET = "PMRSUHIBPWZIEYUVQGG4B4VIL4W6O2RDTPE6YOSMLJTZS7PAXBXT2SZGHWGDJFE5";

// Base32 decoding function
function base32ToBuffer(str) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    let output = new Uint8Array((str.length * 5) / 8 | 0);
    let index = 0;

    for (let i = 0; i < str.length; i++) {
        let char = str[i].toUpperCase();
        let val = alphabet.indexOf(char);
        if (val === -1) continue;

        value = (value << 5) | val;
        bits += 5;

        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return output;
}

// HMAC-SHA1 implementation using Web Crypto API
async function generateHOTP(secret, counter) {
    const keyData = base32ToBuffer(secret);
    const key = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: { name: "SHA-1" } },
        false,
        ["sign"]
    );

    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setBigUint64(0, BigInt(counter), false); // Big-endian

    const signature = await window.crypto.subtle.sign(
        "HMAC",
        key,
        counterBuffer
    );

    const signatureArray = new Uint8Array(signature);
    const offset = signatureArray[signatureArray.length - 1] & 0xf;
    const binary =
        ((signatureArray[offset] & 0x7f) << 24) |
        ((signatureArray[offset + 1] & 0xff) << 16) |
        ((signatureArray[offset + 2] & 0xff) << 8) |
        (signatureArray[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, "0");
}

async function updateTOTP() {
    const epoch = Math.floor(Date.now() / 1000);
    const step = 30;
    const counter = Math.floor(epoch / step);
    const secondsLeft = step - (epoch % step);

    // Generate code
    const code = await generateHOTP(SECRET, counter);

    // Update UI
    updateDisplay(code);
    updateTimer(secondsLeft, step);
}

function updateDisplay(code) {
    const container = document.getElementById('totp-code');
    const firstPart = code.substring(0, 3);
    const secondPart = code.substring(3, 6);

    // Preserve tooltip element if it exists, otherwise re-add it
    const tooltipHtml = '<span class="copy-tooltip" id="copy-tooltip">Copied!</span>';

    container.innerHTML = `
        <span class="digit">${firstPart[0]}</span>
        <span class="digit">${firstPart[1]}</span>
        <span class="digit">${firstPart[2]}</span>
        <span class="separator"> </span>
        <span class="digit">${secondPart[0]}</span>
        <span class="digit">${secondPart[1]}</span>
        <span class="digit">${secondPart[2]}</span>
        ${tooltipHtml}
    `;

    // Store code in dataset for easy access
    container.dataset.code = code;
}

// Add click listener for copying
document.getElementById('totp-code').addEventListener('click', async function () {
    const code = this.dataset.code;
    if (!code) return;

    try {
        await navigator.clipboard.writeText(code);
        showTooltip();
    } catch (err) {
        // Fallback for older browsers or file:// protocol restrictions
        const textArea = document.createElement("textarea");
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showTooltip();
        } catch (err) {
            console.error('Copy failed', err);
            alert('Failed to copy: ' + code);
        }
        document.body.removeChild(textArea);
    }
});

function showTooltip() {
    const tooltip = document.getElementById('copy-tooltip');
    tooltip.classList.add('show');
    setTimeout(() => {
        tooltip.classList.remove('show');
    }, 1500);
}

function updateTimer(secondsLeft, totalSeconds) {
    const progressCircle = document.getElementById('timer-progress');
    const timerText = document.getElementById('timer-text');
    const statusText = document.getElementById('seconds-left');

    const circumference = 2 * Math.PI * 45; // r=45
    const offset = circumference - (secondsLeft / totalSeconds) * circumference;

    progressCircle.style.strokeDashoffset = offset;
    timerText.textContent = secondsLeft;
    statusText.textContent = secondsLeft;

    // Change color based on urgency
    if (secondsLeft <= 5) {
        progressCircle.style.stroke = '#ef4444'; // Red
    } else {
        progressCircle.style.stroke = '#22d3ee'; // Cyan
    }
}

// Initial call and interval
updateTOTP();
setInterval(() => {
    // Re-calculate everything every second to stay synced
    updateTOTP();
}, 1000);
