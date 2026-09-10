/* =========================================================
   CODE GREEN 2026
   8th MIMAROPA Regional IT Congress
   Check-In Frontend
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const DEPLOYED_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbw6aqArIX_eXtrfBDe5_iiqX-97-Zfwbgt3K_P21P56jP0-0tjl8PjKf1o6cyESCwaqSw/exec";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let html5QrCode = null;

let isProcessing = false;

let lastScannedCode = "";

let lastScanTime = 0;

const SCAN_COOLDOWN = 2500;


/* =========================================================
   DOM ELEMENTS
========================================================= */

const searchInput =
    document.getElementById("searchInput");

const submitBtn =
    document.getElementById("submitBtn");

const statusBox =
    document.getElementById("statusBox");

const resultTitle =
    document.getElementById("resultTitle");

const resultName =
    document.getElementById("resultName");

const resultTime =
    document.getElementById("resultTime");

const resultMessage =
    document.getElementById("resultMessage");

const overrideButton =
    document.getElementById("overrideButton");

const overrideAttendeeId =
    document.getElementById("overrideAttendeeId");

const overridePin =
    document.getElementById("overridePin");

const confirmOverride =
    document.getElementById("confirmOverride");


/* =========================================================
   BOOT
========================================================= */

window.addEventListener("load", () => {

    initializeScanner();

    setupEvents();

});


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    submitBtn.addEventListener(
        "click",
        submitManualId
    );


    searchInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                submitManualId();

            }

        }
    );


    overrideButton.addEventListener(
        "click",
        openOverrideModal
    );


    confirmOverride.addEventListener(
        "click",
        processManualOverride
    );


    overrideAttendeeId.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                overridePin.focus();

            }

        }
    );


    overridePin.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                processManualOverride();

            }

        }
    );

}


/* =========================================================
   QR SCANNER
========================================================= */

function initializeScanner() {

    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        updateStatus(
            "error",
            "SCANNER ERROR",
            "",
            "",
            "QR scanner library failed to load."
        );

        return;
    }


    html5QrCode =
        new Html5Qrcode("reader");


    const scannerConfig = {

        fps: 15,

        qrbox: function(
            viewfinderWidth,
            viewfinderHeight
        ) {

            const size =
                Math.floor(
                    Math.min(
                        viewfinderWidth,
                        viewfinderHeight
                    ) * 0.65
                );

            return {
                width: Math.max(180, size),
                height: Math.max(180, size)
            };

        },

        aspectRatio: 1.0,

        rememberLastUsedCamera: true

    };


    /*
        IMPORTANT CAMERA FIX

        Do NOT use:

        facingMode: {
            exact: "environment"
        }

        because some browsers/devices reject this
        constraint and return OverconstrainedError.

        We use a normal environment preference instead.
    */

    html5QrCode
        .start(
            {
                facingMode: "environment"
            },
            scannerConfig,
            handleQrSuccess,
            handleQrError
        )
        .catch(error => {

            console.error(
                "Camera initialization failed:",
                error
            );


            /*
                FALLBACK

                If the browser cannot satisfy the
                environment-camera preference, try
                using the default available camera.
            */

            if (
                error &&
                error.name === "OverconstrainedError"
            ) {

                console.warn(
                    "Environment camera constraint rejected. Retrying with default camera."
                );


                if (html5QrCode) {

                    html5QrCode
                        .start(
                            {
                                video: true
                            },
                            scannerConfig,
                            handleQrSuccess,
                            handleQrError
                        )
                        .catch(fallbackError => {

                            console.error(
                                "Fallback camera initialization failed:",
                                fallbackError
                            );

                            updateStatus(
                                "error",
                                "CAMERA UNAVAILABLE",
                                "",
                                "",
                                getCameraErrorMessage(
                                    fallbackError
                                )
                            );

                        });

                }

                return;
            }


            updateStatus(
                "error",
                "CAMERA UNAVAILABLE",
                "",
                "",
                getCameraErrorMessage(error)
            );

        });

}


/* =========================================================
   CAMERA ERROR MESSAGE
========================================================= */

function getCameraErrorMessage(error) {

    const errorName =
        error &&
        error.name
            ? String(error.name).toLowerCase()
            : "";

    const message =
        String(error || "").toLowerCase();


    if (
        errorName === "notallowederror" ||
        message.includes("permission") ||
        message.includes("notallowed")
    ) {

        return (
            "Camera permission was denied. " +
            "Please allow camera access in your browser settings."
        );

    }


    if (
        errorName === "notfounderror" ||
        message.includes("notfound") ||
        message.includes("devicesnotfound")
    ) {

        return (
            "No camera was detected on this device."
        );

    }


    if (
        errorName === "overconstrainederror" ||
        message.includes("overconstrained")
    ) {

        return (
            "The selected camera mode is not supported by this device. " +
            "Please refresh the page and try again."
        );

    }


    if (
        errorName === "notreadableerror" ||
        message.includes("notreadable") ||
        message.includes("trackstart")
    ) {

        return (
            "The camera is already being used by another application. " +
            "Close other camera applications and try again."
        );

    }


    if (
        errorName === "securityerror"
    ) {

        return (
            "The browser blocked camera access. " +
            "Please make sure the scanner is opened using HTTPS and camera permission is allowed."
        );

    }


    return (
        "Unable to initialize the camera. " +
        "You may still enter the Attendee ID manually."
    );

}


/* =========================================================
   QR SUCCESS
========================================================= */

function handleQrSuccess(decodedText) {

    const now =
        Date.now();


    if (
        decodedText === lastScannedCode &&
        now - lastScanTime < SCAN_COOLDOWN
    ) {

        return;

    }


    lastScannedCode =
        decodedText;

    lastScanTime =
        now;


    const attendeeId =
        String(decodedText)
            .trim()
            .toUpperCase();


    if (!attendeeId) {

        return;

    }


    searchInput.value =
        attendeeId;


    processCheckIn(attendeeId);

}


/* =========================================================
   QR ERROR CALLBACK
========================================================= */

function handleQrError(errorMessage) {

    /*
        html5-qrcode calls this continuously
        while searching for a QR code.

        Do NOT display an error here.
        Otherwise the screen would constantly
        show false camera errors while scanning.
    */

}


/* =========================================================
   MANUAL ID
========================================================= */

function submitManualId() {

    const attendeeId =
        searchInput.value
            .trim()
            .toUpperCase();


    if (!attendeeId) {

        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            "",
            "Please enter an Attendee ID."
        );

        searchInput.focus();

        return;

    }


    processCheckIn(attendeeId);

}


/* =========================================================
   PROCESS CHECK-IN
========================================================= */

function processCheckIn(attendeeId) {

    if (isProcessing) {

        return;

    }


    const session =
        getSelectedStation();


    if (!session) {

        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            "",
            "Please select a check-in station."
        );

        return;

    }


    isProcessing = true;

    setProcessingState(true);


    updateStatus(
        "idle",
        "VERIFYING",
        "",
        "",
        `Checking ${attendeeId}...`
    );


    const payload = {

        action: "scan",

        attendeeId: attendeeId,

        session: session

    };


    fetch(
        DEPLOYED_WEB_APP_URL,
        {

            method: "POST",

            redirect: "follow",

            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body:
                JSON.stringify(payload)

        }
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        return response.text();

    })

    .then(text => {

        console.log(
            "Apps Script response:",
            text
        );


        let result;


        try {

            result =
                JSON.parse(text);

        } catch (error) {

            throw new Error(
                "Invalid JSON response from Apps Script."
            );

        }


        handleResponse(result);

    })

    .catch(error => {

        console.error(
            "Check-in request failed:",
            error
        );


        handleError(error);

    });

}


/* =========================================================
   HANDLE RESPONSE
========================================================= */

function handleResponse(res) {

    console.log(
        "Processed result:",
        res
    );


    const status =
        String(
            res.status || ""
        ).toUpperCase();


    const displayStatus =
        res.displayStatus ||
        getDisplayStatus(status);


    const name =
        res.name ||
        "";


    const attendeeId =
        res.attendeeId ||
        "";


    const timestamp =
        res.timestamp ||
        "";


    const message =
        res.message ||
        "No additional information was provided.";


    /* -----------------------------------------
       SUCCESS
    ------------------------------------------ */

    if (status === "SUCCESS") {

        playSound("success");


        updateStatus(
            "success",
            displayStatus,
            name,
            timestamp,
            message
        );


        showResultModal(
            "success",
            displayStatus,
            name,
            attendeeId,
            timestamp,
            message
        );


        clearInput();

    }


    /* -----------------------------------------
       DUPLICATE
    ------------------------------------------ */

    else if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        updateStatus(
            "already",
            "ALREADY SCANNED",
            name,
            timestamp,
            message
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
            name,
            attendeeId,
            timestamp,
            message
        );


        clearInput();

    }


    /* -----------------------------------------
       BLOCKED
    ------------------------------------------ */

    else if (
        status === "BLOCKED"
    ) {

        playSound("error");


        updateStatus(
            "error",
            "TRY AGAIN",
            name,
            timestamp,
            message
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            name,
            attendeeId,
            timestamp,
            message
        );

    }


    /* -----------------------------------------
       INVALID / ERROR
    ------------------------------------------ */

    else {

        playSound("error");


        updateStatus(
            "error",
            displayStatus || "TRY AGAIN",
            name,
            timestamp,
            message
        );


        showResultModal(
            "error",
            displayStatus || "TRY AGAIN",
            name,
            attendeeId,
            timestamp,
            message
        );

    }


    setTimeout(() => {

        isProcessing = false;

        setProcessingState(false);

    }, 500);

}


/* =========================================================
   HANDLE REQUEST ERROR
========================================================= */

function handleError(error) {

    playSound("error");


    updateStatus(
        "error",
        "CONNECTION ERROR",
        "",
        "",
        "Unable to communicate with the check-in server. Please try again."
    );


    setTimeout(() => {

        isProcessing = false;

        setProcessingState(false);

    }, 500);

}


/* =========================================================
   STATUS DISPLAY
========================================================= */

function updateStatus(
    type,
    title,
    name,
    timestamp,
    message
) {

    statusBox.className =
        `result-panel ${type}`;


    resultTitle.textContent =
        title || "READY TO SCAN";


    resultName.textContent =
        name || "No attendee scanned";


    resultTime.textContent =
        timestamp || "Waiting for QR code...";


    resultMessage.textContent =
        message ||
        "Select a station and scan an attendee QR code.";


    updateResultIcon(type);

}


/* =========================================================
   RESULT ICON
========================================================= */

function updateResultIcon(type) {

    const icon =
        statusBox.querySelector(
            ".result-icon i"
        );


    if (!icon) {

        return;

    }


    icon.className =
        "bi";


    if (type === "success") {

        icon.classList.add(
            "bi-check-circle-fill"
        );

    }


    else if (type === "already") {

        icon.classList.add(
            "bi-exclamation-circle-fill"
        );

    }


    else if (type === "error") {

        icon.classList.add(
            "bi-x-circle-fill"
        );

    }


    else {

        icon.classList.add(
            "bi-qr-code"
        );

    }

}


/* =========================================================
   RESULT MODAL
========================================================= */

function showResultModal(
    type,
    status,
    name,
    attendeeId,
    timestamp,
    message
) {

    const modalElement =
        document.getElementById(
            "resultModal"
        );


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    const modalIcon =
        document.getElementById(
            "modalIcon"
        );


    const modalStatus =
        document.getElementById(
            "modalStatus"
        );


    const modalName =
        document.getElementById(
            "modalName"
        );


    const modalId =
        document.getElementById(
            "modalId"
        );


    const modalTime =
        document.getElementById(
            "modalTime"
        );


    const modalMessage =
        document.getElementById(
            "modalMessage"
        );


    modalIcon.className =
        "modal-result-icon";


    if (type === "success") {

        modalIcon.innerHTML =
            '<i class="bi bi-check-lg"></i>';

        modalIcon.style.color =
            "var(--success)";

        modalStatus.style.color =
            "var(--success)";

    }


    else if (type === "already") {

        modalIcon.innerHTML =
            '<i class="bi bi-exclamation-lg"></i>';

        modalIcon.style.color =
            "var(--warning)";

        modalStatus.style.color =
            "var(--warning)";

    }


    else {

        modalIcon.innerHTML =
            '<i class="bi bi-x-lg"></i>';

        modalIcon.style.color =
            "var(--danger)";

        modalStatus.style.color =
            "var(--danger)";

    }


    modalStatus.textContent =
        status || "TRY AGAIN";


    modalName.textContent =
        name || "ATTENDEE NOT IDENTIFIED";


    modalId.textContent =
        attendeeId || "NO ATTENDEE ID";


    modalTime.textContent =
        timestamp || getCurrentTimestamp();


    modalMessage.textContent =
        message ||
        "Please try again.";


    modal.show();

}


/* =========================================================
   SELECTED STATION
========================================================= */

function getSelectedStation() {

    const selected =
        document.querySelector(
            'input[name="session"]:checked'
        );


    return selected
        ? selected.value
        : null;

}


/* =========================================================
   DISPLAY STATUS FALLBACK
========================================================= */

function getDisplayStatus(status) {

    switch (status) {

        case "SUCCESS":

            return "SCAN SUCCESSFULLY";


        case "ALREADY_SCANNED":

        case "ALREADY_PROCESSED":

            return "ALREADY SCANNED";


        case "BLOCKED":

        case "INVALID":

        case "ERROR":

            return "TRY AGAIN";


        default:

            return "TRY AGAIN";

    }

}


/* =========================================================
   INPUT CLEAR
========================================================= */

function clearInput() {

    searchInput.value = "";

}


/* =========================================================
   PROCESSING STATE
========================================================= */

function setProcessingState(processing) {

    submitBtn.disabled =
        processing;


    if (processing) {

        submitBtn.innerHTML =
            `
            <i class="bi bi-arrow-repeat"></i>
            <span>VERIFYING</span>
            `;

    }


    else {

        submitBtn.innerHTML =
            `
            <i class="bi bi-arrow-right-circle"></i>
            <span>SUBMIT</span>
            `;

    }

}


/* =========================================================
   MANUAL OVERRIDE
========================================================= */

function openOverrideModal() {

    overrideAttendeeId.value =
        searchInput.value
            .trim()
            .toUpperCase();


    overridePin.value = "";


    const modalElement =
        document.getElementById(
            "overrideModal"
        );


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    modal.show();


    setTimeout(() => {

        if (overrideAttendeeId.value) {

            overridePin.focus();

        }

        else {

            overrideAttendeeId.focus();

        }

    }, 300);

}


/* =========================================================
   PROCESS MANUAL OVERRIDE
========================================================= */

function processManualOverride() {

    const attendeeId =
        overrideAttendeeId.value
            .trim()
            .toUpperCase();


    const pin =
        overridePin.value;


    const session =
        getSelectedStation();


    if (!attendeeId) {

        alert(
            "Please enter an Attendee ID."
        );

        overrideAttendeeId.focus();

        return;

    }


    if (!pin) {

        alert(
            "Please enter the override PIN."
        );

        overridePin.focus();

        return;

    }


    if (!session) {

        alert(
            "Please select a check-in station."
        );

        return;

    }


    confirmOverride.disabled =
        true;


    confirmOverride.innerHTML =
        `
        <i class="bi bi-arrow-repeat"></i>
        VERIFYING AUTHORIZATION...
        `;


    fetch(
        DEPLOYED_WEB_APP_URL,
        {

            method: "POST",

            redirect: "follow",

            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body:
                JSON.stringify({

                    action:
                        "manualOverride",

                    attendeeId:
                        attendeeId,

                    session:
                        session,

                    pin:
                        pin

                })

        }
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        return response.text();

    })

    .then(text => {

        console.log(
            "Manual override response:",
            text
        );


        const result =
            JSON.parse(text);


        handleOverrideResponse(
            result,
            attendeeId
        );

    })

    .catch(error => {

        console.error(
            "Manual override error:",
            error
        );


        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            "",
            "Unable to process manual override."
        );

    })

    .finally(() => {

        confirmOverride.disabled =
            false;


        confirmOverride.innerHTML =
            `
            <i class="bi bi-shield-check"></i>
            AUTHORIZE OVERRIDE
            `;

    });

}


/* =========================================================
   MANUAL OVERRIDE RESPONSE
========================================================= */

function handleOverrideResponse(
    res,
    attendeeId
) {

    const status =
        String(
            res.status || ""
        ).toUpperCase();


    const name =
        res.name || "";


    const timestamp =
        res.timestamp || "";


    const message =
        res.message ||
        "Manual override completed.";


    if (status === "SUCCESS") {

        playSound("success");


        updateStatus(
            "success",
            "SCAN SUCCESSFULLY",
            name,
            timestamp,
            message
        );


        showResultModal(
            "success",
            "SCAN SUCCESSFULLY",
            name,
            attendeeId,
            timestamp,
            message
        );


        closeOverrideModal();


        clearInput();

    }


    else if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        updateStatus(
            "already",
            "ALREADY SCANNED",
            name,
            timestamp,
            message
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
            name,
            attendeeId,
            timestamp,
            message
        );


        closeOverrideModal();

    }


    else if (
        status === "INVALID_PIN"
    ) {

        playSound("error");


        overridePin.value = "";


        alert(
            "Invalid override PIN."
        );


        overridePin.focus();

    }


    else {

        playSound("error");


        updateStatus(
            "error",
            "TRY AGAIN",
            name,
            timestamp,
            message
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            name,
            attendeeId,
            timestamp,
            message
        );

    }

}


/* =========================================================
   CLOSE OVERRIDE MODAL
========================================================= */

function closeOverrideModal() {

    const modalElement =
        document.getElementById(
            "overrideModal"
        );


    const modal =
        bootstrap.Modal.getInstance(
            modalElement
        );


    if (modal) {

        modal.hide();

    }

}


/* =========================================================
   AUDIO FEEDBACK
========================================================= */

function playSound(type) {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext) {

            return;

        }


        const context =
            new AudioContext();


        const oscillator =
            context.createOscillator();


        const gain =
            context.createGain();


        oscillator.connect(gain);

        gain.connect(
            context.destination
        );


        if (type === "success") {

            oscillator.frequency.setValueAtTime(
                880,
                context.currentTime
            );


            oscillator.frequency.setValueAtTime(
                1175,
                context.currentTime + 0.10
            );


            gain.gain.setValueAtTime(
                0.18,
                context.currentTime
            );


            gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.30
            );


            oscillator.start();


            oscillator.stop(
                context.currentTime + 0.30
            );

        }


        else {

            oscillator.frequency.setValueAtTime(
                220,
                context.currentTime
            );


            oscillator.frequency.setValueAtTime(
                150,
                context.currentTime + 0.12
            );


            gain.gain.setValueAtTime(
                0.20,
                context.currentTime
            );


            gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.30
            );


            oscillator.start();


            oscillator.stop(
                context.currentTime + 0.30
            );

        }

    }

    catch (error) {

        console.warn(
            "Audio feedback unavailable.",
            error
        );

    }

}


/* =========================================================
   CURRENT TIMESTAMP FALLBACK
========================================================= */

function getCurrentTimestamp() {

    const now =
        new Date();


    return now.toLocaleString(
        "en-PH",
        {

            year: "numeric",

            month: "2-digit",

            day: "2-digit",

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit",

            hour12: true

        }
    );

}