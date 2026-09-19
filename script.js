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
   ATTENDEE DIRECTORY FALLBACK
   The Apps Script endpoint exposes ?action=attendees.
   This guarantees that the UI can resolve FULL NAME and
   SCHOOL from the same Google Sheet even if the scan response
   does not include those fields.
========================================================= */

let attendeeDirectory = [];

function loadAttendeeDirectory() {
    fetch(DEPLOYED_WEB_APP_URL + "?action=attendees", {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    })
    .then(list => {
        if (Array.isArray(list)) {
            attendeeDirectory = list.map(item => ({
                id: String(item.id || item.groupId || "").trim().toUpperCase(),
                name: String(item.name || item.fullName || "").trim(),
                school: String(item.school || "").trim(),
                // Map the dynamic bulk counts directly from Google Sheet columns
                headcount: Number(item.headcount ?? item.headCount ?? 0),
                free: Number(item.free ?? item.freeParticipants ?? 0),
                paying: Number(item.payee ?? item.paying ?? item.payingParticipants ?? 0)
            })).filter(item => item.id);

            console.log("Attendee directory loaded:", attendeeDirectory.length);
        }
    })
    .catch(error => {
        console.warn("Attendee directory fallback unavailable:", error);
    });
}

function findAttendeeById(attendeeId) {
    const cleanId = String(attendeeId || "").trim().toUpperCase();
    if (!cleanId || !Array.isArray(attendeeDirectory) || attendeeDirectory.length === 0) {
        return null;
    }
    
    // Exact ID match against sheet rows
    return attendeeDirectory.find(item => item.id === cleanId) || null;
}


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

    loadAttendeeDirectory();
    initializeScanner();
    setupEvents();

});


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    if (submitBtn) {

        submitBtn.addEventListener(
            "click",
            submitManualId
        );

    }


    if (searchInput) {

        searchInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    submitManualId();

                }

            }
        );

    }


    if (overrideButton) {

        overrideButton.addEventListener(
            "click",
            openOverrideModal
        );

    }


    if (confirmOverride) {

        confirmOverride.addEventListener(
            "click",
            processManualOverride
        );

    }


    if (overrideAttendeeId) {

        overrideAttendeeId.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    if (overridePin) {
                        overridePin.focus();
                    }

                }

            }
        );

    }


    if (overridePin) {

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
        Use a normal environment preference.

        Do NOT use:

        facingMode: {
            exact: "environment"
        }

        because some browsers/devices reject that
        constraint and return OverconstrainedError.
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
                FALLBACK CAMERA

                If the browser cannot satisfy the
                environment-camera preference, try
                the default available camera.
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

    const now = Date.now();

    if (
        decodedText === lastScannedCode &&
        now - lastScanTime < SCAN_COOLDOWN
    ) {
        return;
    }

    lastScannedCode = decodedText;
    lastScanTime = now;

    // --- ADD REGEX EXTRACTION HERE ---
    let attendeeId = String(decodedText).trim();

    // Extract ID inside parentheses if present (e.g., ATT-BLK-CATANGLAO2)
    const match = attendeeId.match(/\((.*?)\)/);
    if (match && match[1]) {
        attendeeId = match[1].trim().toUpperCase();
    } else {
        attendeeId = attendeeId.toUpperCase();
    }
    // ---------------------------------

    if (!attendeeId) {
        return;
    }

    if (searchInput) {
        searchInput.value = attendeeId;
    }

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
        show false errors while scanning.
    */

}


/* =========================================================
   MANUAL ID
========================================================= */

function submitManualId() {

    if (!searchInput) {
        return;
    }


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

    const session = getSelectedStation();

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

    fetch(DEPLOYED_WEB_APP_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Server Error ${response.status}`);
        }
        return response.text();
    })
    .then(text => {
        console.log("Apps Script response:", text);

        // Catch Google Apps Script HTML error pages before JSON parsing fails
        if (text.trim().startsWith("<!DOCTYPE") || text.includes("<html")) {
            throw new Error("Server execution timeout. Please tap scan again.");
        }

        let result;

        try {
            result = JSON.parse(text);
        } catch (error) {
            console.error("JSON parsing failed:", error);
            throw new Error("Invalid response format received from server.");
        }

        handleResponse(result);
    })
    .catch(error => {
        console.error("Check-in request failed:", error);
        
        // Pass the actual message to the UI instead of falling back to generic text
        updateStatus(
            "error",
            "CONNECTION ERROR",
            "",
            typeof getCurrentTimestamp === "function" ? getCurrentTimestamp() : "",
            error.message || "Unable to communicate with the check-in server."
        );
    })
    .finally(() => {
        isProcessing = false;
        setProcessingState(false);
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


    /*
        IMPORTANT

        Apps Script responses may be returned as:

        1. Direct object:

        {
            status: "SUCCESS",
            name: "CASEY JASPER CHAVEZ",
            attendeeId: "ATT-IND-CHAVEZ1",
            timestamp: "...",
            message: "..."
        }

        OR:

        2. Wrapped object:

        {
            found: true,
            result: {
                status: "SUCCESS",
                name: "CASEY JASPER CHAVEZ",
                attendeeId: "ATT-IND-CHAVEZ1",
                timestamp: "...",
                message: "..."
            }
        }

        This normalization handles BOTH.
    */

    const data =
        res &&
        res.result &&
        typeof res.result === "object"
            ? res.result
            : res;


    /* ---------------------------------------------------------
       INVALID RESPONSE
    --------------------------------------------------------- */

    if (
        !data ||
        typeof data !== "object"
    ) {

        console.error(
            "Invalid Apps Script response:",
            res
        );


        playSound("error");


        const timestamp =
            getCurrentTimestamp();


        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            timestamp,
            "The check-in server returned an invalid response."
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            "",
            timestamp,
            "The check-in server returned an invalid response."
        );


        finishProcessing();

        return;

    }
    
/* ---------------------------------------------------------
       NORMALIZE RESPONSE VALUES & DYNAMIC DIRECTORY LOOKUP
    --------------------------------------------------------- */

    const status = String(data.status || "").trim().toUpperCase();
    const displayStatus = String(data.displayStatus || getDisplayStatus(status)).trim();
    const rawMessage = String(data.message || data.text || "").trim();

    /* 1. Extract Name & ID from raw message if server didn't split them */
    let parsedName = String(data.name || data.fullName || data.fullname || "").trim();
    let parsedId = String(data.attendeeId || data.id || "").trim();

    const match = rawMessage.match(/\[(?:SUCCESS|ALREADY|ERROR)\]\s+(.*?)\s+\((.*?)\)/i);
    if (match) {
        if (!parsedName) parsedName = match[1].trim();
        if (!parsedId) parsedId = match[2].trim();
    }

    const attendeeId = parsedId;
    const safeAttendeeId = attendeeId.toUpperCase();

    /* 2. Find matching row from loaded Sheets directory */
    const directoryRecord = safeAttendeeId ? findAttendeeById(safeAttendeeId) : null;

    const name = parsedName || (directoryRecord && directoryRecord.name) || "";
    const school = String(
        data.school || 
        data.schoolName || 
        (directoryRecord && directoryRecord.school) || 
        ""
    ).trim();

    const timestamp = String(data.timestamp || "").trim();
    const message = rawMessage || "Attendance recorded successfully.";

    /* 3. Bulk Info - Dynamically pull numbers from backend OR directoryRecord */
    const bulkFlag =
        data.isBulk === true ||
        String(data.isBulk || "").toLowerCase() === "true" ||
        String(data.isBulk || "") === "1" ||
        safeAttendeeId.startsWith("ATT-BLK-");

    const bulkInfo = bulkFlag
        ? {
            isBulk: true,
            name: name,
            id: safeAttendeeId,
            school: school,
            headcount: Number(
                data.headcount ?? 
                data.headCount ?? 
                (directoryRecord && directoryRecord.headcount) ?? 
                0
            ),
            free: Number(
                data.free ?? 
                data.freeParticipants ?? 
                (directoryRecord && directoryRecord.free) ?? 
                0
            ),
            payingParticipants: Number(
                data.payingParticipants ??
                data.paying ??
                (directoryRecord && directoryRecord.paying) ??
                0
            )
        }
        : null;

    /* =========================================================
       SUCCESS
    ========================================================= */

    if (
        status === "SUCCESS"
    ) {

        playSound("success");


        /*
            If the backend sends the attendee name,
            use it.

            If the name is unavailable but the attendee ID
            exists, display the attendee ID instead.

            This prevents the misleading:

            "ATTENDEE NOT IDENTIFIED"

            message.
        */

        const safeName =
            name ||
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        const safeMessage =
            message ||
            "Check-in recorded successfully.";


        updateStatus(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            safeTimestamp,
            safeMessage
        );


        showResultModal(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            bulkInfo,
            school

        );


        clearInput();


        finishProcessing();

        return;

    }


    /* =========================================================
       ALREADY SCANNED
    ========================================================= */

    if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        const safeName =
            name ||
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        const safeMessage =
            message ||
            "This attendee has already been recorded.";


        updateStatus(
            "already",
            "ALREADY SCANNED",
            safeName,
            safeTimestamp,
            safeMessage
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            bulkInfo,
            school
        );


        clearInput();


        finishProcessing();

        return;

    }


    /* =========================================================
       BLOCKED / VALIDATION FAILURE
    ========================================================= */

    if (
        status === "BLOCKED"
    ) {

        playSound("error");


        const safeName =
            name ||
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        const safeMessage =
            message ||
            "This check-in cannot be processed yet.";


        updateStatus(
            "error",
            "TRY AGAIN",
            safeName,
            safeTimestamp,
            safeMessage
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            null,
            school
        );


        finishProcessing();

        return;

    }


    /* =========================================================
       INVALID / UNKNOWN ERROR
    ========================================================= */

    playSound("error");


    const safeName =
        name ||
        attendeeId ||
        "";


    const safeTimestamp =
        timestamp ||
        getCurrentTimestamp();


    const safeMessage =
        message ||
        "Unable to process this check-in. Please try again.";


    updateStatus(
        "error",
        "TRY AGAIN",
        safeName,
        safeTimestamp,
        safeMessage
    );


    showResultModal(
        "error",
        "TRY AGAIN",
        safeName,
        attendeeId,
        safeTimestamp,
        safeMessage,
        null,
        school
    );


    finishProcessing();

}


/* =========================================================
   FINISH PROCESSING
========================================================= */

function finishProcessing() {

    setTimeout(() => {

        isProcessing = false;

        setProcessingState(false);

    }, 500);

}


/* =========================================================
   HANDLE REQUEST ERROR
========================================================= */

function handleError(error) {

    console.error(
        "Request error:",
        error
    );


    playSound("error");


    const timestamp =
        getCurrentTimestamp();


    updateStatus(
        "error",
        "CONNECTION ERROR",
        "",
        timestamp,
        "Unable to communicate with the check-in server. Please try again."
    );


    showResultModal(
        "error",
        "TRY AGAIN",
        "",
        "",
        timestamp,
        "Unable to communicate with the check-in server. Please try again."
    );


    finishProcessing();

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

    if (!statusBox) {
        return;
    }


    statusBox.className =
        `result-panel ${type}`;


    if (resultTitle) {

        resultTitle.textContent =
            title ||
            "READY TO SCAN";

    }


    if (resultName) {

        resultName.textContent =
            name ||
            "No attendee scanned";

    }


    if (resultTime) {

        resultTime.textContent =
            timestamp ||
            "Waiting for QR code...";

    }


    if (resultMessage) {

        resultMessage.textContent =
            message ||
            "Select a station and scan an attendee QR code.";

    }


    updateResultIcon(type);

}


/* =========================================================
   RESULT ICON
========================================================= */

function updateResultIcon(type) {

    if (!statusBox) {
        return;
    }


    const icon =
        statusBox.querySelector(
            ".result-icon i"
        );


    if (!icon) {
        return;
    }


    icon.className =
        "bi";


    if (
        type === "success"
    ) {

        icon.classList.add(
            "bi-check-circle-fill"
        );

    }


    else if (
        type === "already"
    ) {

        icon.classList.add(
            "bi-exclamation-circle-fill"
        );

    }


    else if (
        type === "error"
    ) {

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

/* =========================================================
   RESULT MODAL
   MOBILE-FIRST SCAN RESULT DISPLAY
========================================================= */

function showResultModal(
    type,
    status,
    name,
    attendeeId,
    timestamp,
    message,
    bulkInfo = null,
    school = ""
) {
    const modalElement = document.getElementById("resultModal");

    if (!modalElement) {
        console.error("Result modal element not found.");
        return;
    }

    /* -----------------------------------------------------
       GET MODAL ELEMENTS
    ----------------------------------------------------- */

    const modalIcon =
        document.getElementById("modalIcon");

    const modalStatus =
        document.getElementById("modalStatus");

    const modalName =
        document.getElementById("modalName");

    const modalId =
        document.getElementById("modalId");

    const modalTime =
        document.getElementById("modalTime");

    const modalMessage =
        document.getElementById("modalMessage");

    /* Individual school block (used only for individual registrations). */
    const individualSchool =
        document.getElementById("individualSchoolDisplay") ||
        modalElement.querySelector(".individual-school");

    const individualSchoolLabel =
        document.getElementById("individualSchoolLabel");

    const individualModalSchool =
        document.getElementById("individualModalSchool");


    /* BULK REGISTRATION MODAL ELEMENTS */

    const bulkRegistrationInfo =
        document.getElementById("bulkRegistrationInfo");

    const modalSchool =
        document.getElementById("modalSchool");

    const modalHeadcount =
        document.getElementById("modalHeadcount");

    const modalPaying =
        document.getElementById("modalPaying");

    const modalFree =
        document.getElementById("modalFree");


    /* -----------------------------------------------------
       NORMALIZE DATA
    ----------------------------------------------------- */

    const safeType =
        String(type || "error").toLowerCase();

    const safeStatus =
        String(status || "TRY AGAIN");

    const safeName =
        String(name || "ATTENDEE NOT IDENTIFIED");

    const safeId =
        String(attendeeId || "NO ATTENDEE ID");

    const safeTimestamp =
        String(timestamp || getCurrentTimestamp());

    const safeMessage =
        String(
            message ||
            "Please try again."
        );


    /* -----------------------------------------------------
       RESET MODAL
    ----------------------------------------------------- */

    modalElement.classList.remove(
        "modal-success",
        "modal-already",
        "modal-error"
    );


    /* -----------------------------------------------------
       STATUS TYPE
    ----------------------------------------------------- */

    if (safeType === "success") {

        modalElement.classList.add(
            "modal-success"
        );

        if (modalIcon) {
            modalIcon.innerHTML =
                '<i class="bi bi-check-lg"></i>';
        }

        if (modalStatus) {
            modalStatus.textContent =
                "SCAN SUCCESSFULLY";
        }

    }

    else if (safeType === "already") {

        modalElement.classList.add(
            "modal-already"
        );

        if (modalIcon) {
            modalIcon.innerHTML =
                '<i class="bi bi-exclamation-lg"></i>';
        }

        if (modalStatus) {
            modalStatus.textContent =
                "ALREADY SCANNED";
        }

    }

    else {

        modalElement.classList.add(
            "modal-error"
        );

        if (modalIcon) {
            modalIcon.innerHTML =
                '<i class="bi bi-x-lg"></i>';
        }

        if (modalStatus) {
            modalStatus.textContent =
                safeStatus;
        }
    }


    /* -----------------------------------------------------
        POPULATE ATTENDEE INFORMATION
    ----------------------------------------------------- */

    // Check if bulkInfo contains the attendee details when passed
    const finalName = (bulkInfo && bulkInfo.name) || safeName;
    const finalId = (bulkInfo && bulkInfo.id) || safeId;

    if (modalName) {
        modalName.textContent = finalName;
    }

    if (modalId) {
        modalId.textContent = finalId;
    }

    if (modalTime) {
        modalTime.textContent = safeTimestamp;
    }

    /* Force the success message to clean string */
    if (modalMessage) {
        modalMessage.textContent = "Attendance recorded successfully.";
    }

    /* ---------------------------------------------------------
        REGISTRATION SUMMARY CARD
    --------------------------------------------------------- */

    if (bulkRegistrationInfo) {
        bulkRegistrationInfo.style.display = "block";

        if (individualSchool) {
            individualSchool.style.display = "none";
        }

        const bulkSchoolLabel =
            bulkRegistrationInfo.querySelector(".bulk-school .bulk-label");

        if (bulkSchoolLabel) {
            bulkSchoolLabel.textContent = "SCHOOL / ORGANIZATION";
        }

        /* Resolve School Name */
        const directoryRecordForSchool =
            finalId && finalId !== "NO ATTENDEE ID" && finalId !== "ATTENDEE"
                ? findAttendeeById(finalId)
                : null;

        const resolvedSchool =
            (bulkInfo && bulkInfo.school) ||
            school ||
            (directoryRecordForSchool && directoryRecordForSchool.school) ||
            "Not Specified";

        if (modalSchool) {
            modalSchool.textContent = resolvedSchool;
        }

        /* Populate summary counts */
        if (modalHeadcount) {
            const val = bulkInfo ? bulkInfo.headcount : 0;
            modalHeadcount.textContent = Number(val || 0).toLocaleString();
        }

        if (modalPaying) {
            const val = bulkInfo ? (bulkInfo.payingParticipants || bulkInfo.paying) : 0;
            modalPaying.textContent = Number(val || 0).toLocaleString();
        }

        if (modalFree) {
            const val = bulkInfo ? bulkInfo.free : 0;
            modalFree.textContent = Number(val || 0).toLocaleString();
        }
    }

    /* -----------------------------------------------------
       SHOW MODAL
    ----------------------------------------------------- */

    try {

        const modal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement,
                {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                }
            );

        modal.show();

        /*
         * Force the modal to the front.
         * This is particularly useful on mobile browsers
         * where scanner/video elements may create stacking
         * contexts.
         */

        requestAnimationFrame(() => {

            modalElement.style.zIndex = "1060";

            const backdrop =
                document.querySelector(
                    ".modal-backdrop"
                );

            if (backdrop) {
                backdrop.style.zIndex = "1055";
            }

        });

    }

    catch (error) {

        console.error(
            "Unable to display result modal:",
            error
        );

        /*
         * Fallback:
         * If Bootstrap fails for any reason,
         * keep the result visible in the main status panel.
         */

        updateStatus(
            safeType,
            safeStatus,
            safeName,
            safeTimestamp,
            safeMessage
        );
    }
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

    if (searchInput) {

        searchInput.value = "";

    }

}


/* =========================================================
   PROCESSING STATE
========================================================= */

function setProcessingState(processing) {

    if (!submitBtn) {
        return;
    }


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

    if (overrideAttendeeId) {

        overrideAttendeeId.value =
            searchInput
                ? searchInput.value
                    .trim()
                    .toUpperCase()
                : "";

    }


    if (overridePin) {

        overridePin.value =
            "";

    }


    const modalElement =
        document.getElementById(
            "overrideModal"
        );


    if (!modalElement) {

        console.error(
            "Override modal element not found."
        );

        return;

    }


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    modal.show();


    setTimeout(() => {

        if (
            overrideAttendeeId &&
            overrideAttendeeId.value
        ) {

            if (overridePin) {

                overridePin.focus();

            }

        }

        else if (
            overrideAttendeeId
        ) {

            overrideAttendeeId.focus();

        }

    }, 300);

}


/* =========================================================
   PROCESS MANUAL OVERRIDE
========================================================= */
function processManualOverride() {
    const attendeeId = overrideAttendeeId
        ? overrideAttendeeId.value.trim().toUpperCase()
        : "";

    const pin = overridePin
        ? overridePin.value
        : "";

    const session = getSelectedStation();

    if (!attendeeId) {
        alert("Please enter an Attendee ID.");
        if (overrideAttendeeId) overrideAttendeeId.focus();
        return;
    }

    if (!pin) {
        alert("Please enter the override PIN.");
        if (overridePin) overridePin.focus();
        return;
    }

    if (!session) {
        alert("Please select a check-in station.");
        return;
    }

    if (confirmOverride) {
        confirmOverride.disabled = true;
        confirmOverride.innerHTML = `
            <i class="bi bi-arrow-repeat"></i>
            VERIFYING AUTHORIZATION...
        `;
    }

    fetch(DEPLOYED_WEB_APP_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            action: "manualOverride",
            attendeeId: attendeeId,
            session: session,
            pin: pin
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Server Error ${response.status}`);
        }
        return response.text();
    })
    .then(text => {
        console.log("Manual override response:", text);

        // Intercept Apps Script HTML crash pages before JSON parsing fails
        if (text.trim().startsWith("<!DOCTYPE") || text.includes("<html")) {
            throw new Error("Server execution timeout. Please try authorizing again.");
        }

        let result;

        try {
            result = JSON.parse(text);
        } catch (error) {
            console.error("JSON parsing failed:", error);
            throw new Error("Invalid response format received from server.");
        }

        handleOverrideResponse(result, attendeeId);
    })
    .catch(error => {
        console.error("Manual override error:", error);

        const timestamp = typeof getCurrentTimestamp === "function" ? getCurrentTimestamp() : "";
        const errorMessage = error.message || "Unable to process manual override.";

        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            timestamp,
            errorMessage
        );

        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            attendeeId,
            timestamp,
            errorMessage
        );
    })
    .finally(() => {
        if (confirmOverride) {
            confirmOverride.disabled = false;
            confirmOverride.innerHTML = `
                <i class="bi bi-shield-check"></i>
                AUTHORIZE OVERRIDE
            `;
        }
    });

}


/* =========================================================
   MANUAL OVERRIDE RESPONSE
========================================================= */

function handleOverrideResponse(
    res,
    attendeeId
) {

    /*
        Normalize wrapped responses too.
    */

    const data =
        res &&
        res.result &&
        typeof res.result === "object"
            ? res.result
            : res;


    if (!data || typeof data !== "object") {

        playSound("error");


        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            attendeeId,
            getCurrentTimestamp(),
            "Invalid response from the check-in server."
        );


        return;

    }


    const status =
        String(
            data.status || ""
        )
            .trim()
            .toUpperCase();

    const safeAttendeeId = (typeof attendeeId !== "undefined" && attendeeId) 
        ? attendeeId 
        : (data && (data.attendeeId || data.id)) || "";

    const directoryRecord = safeAttendeeId ? findAttendeeById(safeAttendeeId) : null;

    const name =
        String(
            data.name ||
            data.fullName ||
            data.fullname ||
            (directoryRecord && directoryRecord.name) ||
            ""
        )
            .trim();

    const school =
        String(
            data.school ||
            data.schoolName ||
            (directoryRecord && directoryRecord.school) ||
            ""
        )
            .trim();


    const timestamp =
        String(
            data.timestamp || ""
        )
            .trim();


    const message =
        String(
            data.message ||
            "Manual override completed."
        )
            .trim();


    /* ---------------------------------------------------------
       SUCCESS
    --------------------------------------------------------- */

    if (
        status === "SUCCESS"
    ) {

        playSound("success");


        const safeName =
            name ||
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        updateStatus(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            safeTimestamp,
            message
        );


        showResultModal(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            attendeeId,
            safeTimestamp,
            message,
            null,
            school
        );


        closeOverrideModal();


        clearInput();


        return;

    }


    /* ---------------------------------------------------------
       ALREADY SCANNED
    --------------------------------------------------------- */

    if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        const safeName =
            name ||
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        updateStatus(
            "already",
            "ALREADY SCANNED",
            safeName,
            safeTimestamp,
            message
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
            safeName,
            attendeeId,
            safeTimestamp,
            message,
            null,
            school
        );


        closeOverrideModal();


        return;

    }


    /* ---------------------------------------------------------
       INVALID PIN
    --------------------------------------------------------- */

    if (
        status === "INVALID_PIN"
    ) {

        playSound("error");


        if (overridePin) {

            overridePin.value =
                "";

        }


        alert(
            "Invalid override PIN."
        );


        if (overridePin) {

            overridePin.focus();

        }


        return;

    }


    /* ---------------------------------------------------------
       OTHER ERROR
    --------------------------------------------------------- */

    playSound("error");


    const safeName =
        name ||
        attendeeId ||
        "";


    const safeTimestamp =
        timestamp ||
        getCurrentTimestamp();


    showResultModal(
        "error",
        "TRY AGAIN",
        safeName,
        attendeeId,
        safeTimestamp,
        message
    );

}


/* =========================================================
   CLOSE OVERRIDE MODAL
========================================================= */

function closeOverrideModal() {

    const modalElement =
        document.getElementById(
            "overrideModal"
        );


    if (!modalElement) {

        return;

    }


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


        oscillator.connect(
            gain
        );


        gain.connect(
            context.destination
        );


        /* -----------------------------------------------------
           SUCCESS SOUND
        ----------------------------------------------------- */

        if (
            type === "success"
        ) {

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


        /* -----------------------------------------------------
           ERROR SOUND
        ----------------------------------------------------- */

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