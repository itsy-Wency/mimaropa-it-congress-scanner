/* =========================================================
   CODE GREEN 2026
   8th MIMAROPA Regional IT Congress
   Check-In Frontend
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const DEPLOYED_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyLseZj1D40TxYwQXd87Kbcj78Zqhp8kKljXEwciCuFXlJXtGw_li5FmsxAcWyQeKr1Hw/exec";


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
                id: String(item.id || "").trim().toUpperCase(),
                name: String(item.name || "").trim(),
                school: String(item.school || "").trim(),
                isBulk:
                    item.isBulk === true ||
                    String(item.isBulk || "").toLowerCase() === "true" ||
                    String(item.isBulk || "") === "1"
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

    return attendeeDirectory.find(item => {
        if (!item) return false;
        const itemId = String(item.id || item.attendeeId || "").trim().toUpperCase();
        return itemId === cleanId;
    }) || null;
}

function resolveSchoolName(rawSchool, directoryRecord, fallback = "School Not Specified") {
    const directSchool = String(rawSchool || "").trim();
    if (directSchool) return directSchool;

    const directorySchool = directoryRecord ? String(directoryRecord.school || "").trim() : "";
    if (directorySchool) return directorySchool;

    return fallback || "";
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

    console.log("Processed result:", res);


    /* =====================================================
       NORMALIZE APPS SCRIPT RESPONSE
    ===================================================== */

    const data =
        res &&
        res.result &&
        typeof res.result === "object"
            ? res.result
            : res;


    /* =====================================================
       INVALID RESPONSE
    ===================================================== */

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
            "The check-in server returned an invalid response.",
            null,
            ""
        );

        finishProcessing();

        return;
    }


    /* =====================================================
       BASIC RESPONSE VALUES
    ===================================================== */

    const status =
        String(
            data.status || ""
        )
        .trim()
        .toUpperCase();


    const displayStatus =
        String(
            data.displayStatus ||
            getDisplayStatus(status)
        )
        .trim();


    const rawMessage =
        String(
            data.message ||
            data.text ||
            ""
        )
        .trim();


    /* =====================================================
       NAME
    ===================================================== */

    let name =
        String(
            data.name ||
            data.fullName ||
            data.fullname ||
            ""
        )
        .trim();


    /* =====================================================
       ATTENDEE ID
    ===================================================== */

    let attendeeId =
        String(
            data.attendeeId ||
            data.id ||
            ""
        )
        .trim();


    /* =====================================================
       FALLBACK PARSER FOR OLD RESPONSES

       Example:

       [SUCCESS] JOHN DOE (ATT-123) marked PRESENT.
    ===================================================== */

    if (
        !name ||
        !attendeeId
    ) {

        const match =
            rawMessage.match(
                /\[(?:SUCCESS|ALREADY|ERROR|ALREADY_PROCESSED)\]\s+(.*?)\s+\((.*?)\)/i
            );


        if (match) {

            if (!name) {
                name =
                    match[1].trim();
            }

            if (!attendeeId) {
                attendeeId =
                    match[2].trim();
            }
        }
    }


    /* =====================================================
       DIRECTORY FALLBACK
    ===================================================== */

    const safeAttendeeId =
        attendeeId
            .toUpperCase();


    const directoryRecord =
        safeAttendeeId
            ? findAttendeeById(
                safeAttendeeId
            )
            : null;


    /* =====================================================
       FINAL NAME

       Backend has priority.
    ===================================================== */

    name =
        String(
            data.name ||
            data.fullName ||
            data.fullname ||
            (
                directoryRecord &&
                directoryRecord.name
            ) ||
            name ||
            ""
        )
        .trim();


    /* =====================================================
       SCHOOL

       IMPORTANT:

       Backend Column F has priority.

       Directory is only fallback.
    ===================================================== */

    const school =
        String(
            data.school ||
            data.schoolName ||
            (
                directoryRecord &&
                directoryRecord.school
            ) ||
            ""
        )
        .trim();


    /* =====================================================
       TIMESTAMP
    ===================================================== */

    const timestamp =
        String(
            data.timestamp ||
            ""
        )
        .trim();


    /* =====================================================
       MESSAGE
    ===================================================== */

    const message =
        rawMessage ||
        "No additional information was provided.";


    /* =====================================================
       BULK INFORMATION

       IMPORTANT:

       This section appears ONLY ONCE.

       No attendee-ID prefix checking.
    ===================================================== */

    const serverBulkInfo =
        data.bulkInfo &&
        typeof data.bulkInfo === "object"
            ? data.bulkInfo
            : null;


    /* =====================================================
       DETERMINE BULK STATUS
    ===================================================== */

    const bulkFlag =
        data.isBulk === true ||

        (
            serverBulkInfo &&
            serverBulkInfo.isBulk === true
        ) ||

        String(
            data.isBulk || ""
        ).toLowerCase() === "true" ||

        (
            serverBulkInfo &&
            String(
                serverBulkInfo.isBulk || ""
            ).toLowerCase() === "true"
        ) ||

        String(
            data.isBulk || ""
        ) === "1" ||

        (
            serverBulkInfo &&
            String(
                serverBulkInfo.isBulk || ""
            ) === "1"
        );


    /* =====================================================
       BUILD BULK INFO
    ===================================================== */

    let bulkInfo = null;


    if (bulkFlag) {

        bulkInfo = {

            isBulk: true,


            /* ---------------------------------------------
               COLUMN F
               SCHOOL
            --------------------------------------------- */

            school:
                String(
                    data.school ||
                    data.schoolName ||
                    (
                        serverBulkInfo &&
                        serverBulkInfo.school
                    ) ||
                    ""
                )
                .trim(),


            /* ---------------------------------------------
               COLUMN M
               HEADCOUNT
            --------------------------------------------- */

            headcount:
                Number(
                    data.headcount ??
                    data.headCount ??
                    (
                        serverBulkInfo &&
                        serverBulkInfo.headcount
                    ) ??
                    (
                        data.registration &&
                        data.registration.headcount
                    ) ??
                    0
                ),


            /* ---------------------------------------------
               COLUMN N
               FREE
            --------------------------------------------- */

            free:
                Number(
                    data.free ??
                    data.freeParticipants ??
                    (
                        serverBulkInfo &&
                        serverBulkInfo.free
                    ) ??
                    (
                        serverBulkInfo &&
                        serverBulkInfo.freeParticipants
                    ) ??
                    (
                        data.registration &&
                        data.registration.free
                    ) ??
                    0
                ),


            /* ---------------------------------------------
               COLUMN O
               PAYEE

               DO NOT calculate HEADCOUNT - FREE
            --------------------------------------------- */

            payingParticipants:
                Number(
                    data.payingParticipants ??
                    data.payee ??
                    (
                        serverBulkInfo &&
                        serverBulkInfo.payingParticipants
                    ) ??
                    (
                        serverBulkInfo &&
                        serverBulkInfo.payee
                    ) ??
                    (
                        data.registration &&
                        data.registration.payee
                    ) ??
                    0
                )

        };
    }


    /* =====================================================
       DEBUG
    ===================================================== */

    console.log(
        "========== SERVER RESPONSE =========="
    );

    console.log(
        data
    );

    console.log(
        "NAME:",
        name
    );

    console.log(
        "SCHOOL:",
        school
    );

    console.log(
        "IS BULK:",
        bulkFlag
    );

    console.log(
        "BULK INFO:",
        bulkInfo
    );


    /* =====================================================
       REGISTRATION OBJECT
    ===================================================== */

    const serverRegistration =
        data.registration &&
        typeof data.registration === "object"
            ? data.registration
            : {};


    const registration = {

        ...serverRegistration,

        groupId:
            attendeeId,

        fullName:
            name,

        certificateName:
            data.certificateName ||
            serverRegistration.certificateName ||
            "",

        email:
            data.email ||
            serverRegistration.email ||
            "",

        contact:
            data.contact ||
            serverRegistration.contact ||
            "",

        school:
            school,

        attendance:
            data.attendanceStatus ||
            serverRegistration.attendance ||
            "",

        attendanceTime:
            data.attendanceTime ||
            serverRegistration.attendanceTime ||
            "",

        amSnack:
            data.amSnack ||
            serverRegistration.amSnack ||
            "",

        amSnackTime:
            data.amSnackTime ||
            serverRegistration.amSnackTime ||
            "",

        pmSnack:
            data.pmSnack ||
            serverRegistration.pmSnack ||
            "",

        pmSnackTime:
            data.pmSnackTime ||
            serverRegistration.pmSnackTime ||
            "",

        headcount:
            bulkInfo
                ? bulkInfo.headcount
                : 0,

        free:
            bulkInfo
                ? bulkInfo.free
                : 0,

        payee:
            bulkInfo
                ? bulkInfo.payingParticipants
                : 0
    };


    /* =====================================================
       FINAL NORMALIZED RESPONSE
    ===================================================== */

    const normalizedResponse = {

        status:
            status,

        displayStatus:
            displayStatus,

        name:
            name,

        attendeeId:
            attendeeId,

        school:
            school,

        timestamp:
            timestamp,

        message:
            message,

        isBulk:
            bulkFlag,

        bulkInfo:
            bulkInfo,

        registration:
            registration

    };


    console.log(
        "Normalized scan response:",
        normalizedResponse
    );


    /* =====================================================
       SUCCESS
    ===================================================== */

    if (
        status === "SUCCESS"
    ) {

        playSound("success");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
        formatModalTimestamp(
            timestamp || getCurrentTimestamp()
        );


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


    /* =====================================================
       ALREADY SCANNED

       Supports both:

       ALREADY_SCANNED
       ALREADY_PROCESSED
    ===================================================== */

    if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        const safeName =
            name ||
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


    /* =====================================================
       BLOCKED
    ===================================================== */

    if (
        status === "BLOCKED"
    ) {

        playSound("error");


        const safeName =
            name ||
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
            bulkInfo,
            school
        );


        finishProcessing();

        return;
    }


    /* =====================================================
       INVALID / UNKNOWN ERROR
    ===================================================== */

    playSound("error");


    const safeName =
        name ||
        attendeeId ||
        "ATTENDEE";


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
        bulkInfo,
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

    const modalElement =
        document.getElementById("resultModal");

    if (!modalElement) {
        console.error(
            "Result modal element not found."
        );
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


    /* -----------------------------------------------------
       INDIVIDUAL SCHOOL
    ----------------------------------------------------- */

    const individualSchool =
        document.getElementById(
            "individualSchoolDisplay"
        ) ||
        modalElement.querySelector(
            ".individual-school"
        );

    const individualModalSchool =
        document.getElementById(
            "individualModalSchool"
        );


    /* -----------------------------------------------------
       BULK REGISTRATION INFORMATION
    ----------------------------------------------------- */

    const bulkRegistrationInfo =
        document.getElementById(
            "bulkRegistrationInfo"
        );

    const modalSchool =
        document.getElementById(
            "modalSchool"
        );

    const modalHeadcount =
        document.getElementById(
            "modalHeadcount"
        );

    const modalPaying =
        document.getElementById(
            "modalPaying"
        );

    const modalFree =
        document.getElementById(
            "modalFree"
        );


    /* -----------------------------------------------------
       NORMALIZE BASIC DATA
    ----------------------------------------------------- */

    const safeType =
        String(
            type || "error"
        ).toLowerCase();

    const safeStatus =
        String(
            status || "TRY AGAIN"
        );

    const safeName =
        String(
            name ||
            "ATTENDEE NOT IDENTIFIED"
        );

    const safeId =
        String(
            attendeeId ||
            "NO ATTENDEE ID"
        );

    const safeTimestamp =
        String(
            timestamp ||
            getCurrentTimestamp()
        );

    const safeMessage =
        String(
            message ||
            "Please try again."
        );


    /* -----------------------------------------------------
       RESET MODAL STYLE
    ----------------------------------------------------- */

    modalElement.classList.remove(
        "modal-success",
        "modal-already",
        "modal-error"
    );


    /* -----------------------------------------------------
       STATUS TYPE
    ----------------------------------------------------- */

    if (
        safeType === "success"
    ) {

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

    else if (
        safeType === "already"
    ) {

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
       POPULATE BASIC ATTENDEE INFORMATION
    ----------------------------------------------------- */

    if (modalName) {
        modalName.textContent =
            safeName;
    }

    if (modalId) {
        modalId.textContent =
            safeId;
    }

    if (modalTime) {
        modalTime.textContent =
            safeTimestamp;
    }

    if (modalMessage) {
        modalMessage.textContent =
            safeMessage;
    }


    /* =====================================================
       REGISTRATION TYPE
       
       IMPORTANT:
       
       The frontend DOES NOT determine bulk status from
       the attendee ID.
       
       It only trusts:
       
           bulkInfo.isBulk === true
       
       which ultimately comes from the Apps Script backend.
    ===================================================== */

    const isBulk =
        bulkInfo &&
        (
            bulkInfo.isBulk === true ||
            String(
                bulkInfo.isBulk || ""
            ).toLowerCase() === "true" ||
            String(
                bulkInfo.isBulk || ""
            ) === "1"
        );


    /* =====================================================
       ALWAYS RESET BOTH SECTIONS FIRST
       
       This is extremely important.
       
       Example:
       
       Scan #1 = BULK
       → bulk summary is shown
       
       Scan #2 = INDIVIDUAL
       → bulk summary MUST be hidden again
       
       Therefore we hide the bulk section BEFORE checking
       whether the current scan is bulk.
    ===================================================== */

    if (bulkRegistrationInfo) {
        bulkRegistrationInfo.style.display =
            "none";
    }

    if (individualSchool) {
        individualSchool.style.display =
            "none";
    }


    /* =====================================================
       BULK REGISTRATION
    ===================================================== */

    if (isBulk) {

        console.log(
            "Rendering BULK registration information:",
            bulkInfo
        );


        /* -------------------------------------------------
           SHOW BULK SUMMARY
        ------------------------------------------------- */

        if (bulkRegistrationInfo) {
            bulkRegistrationInfo.style.display =
                "block";
        }


        /* -------------------------------------------------
           SCHOOL
           
           Backend data.school should be Column F.
           
           bulkInfo.school was created from data.school
           during normalization.
        ------------------------------------------------- */

        const resolvedBulkSchool =
            String(
                bulkInfo.school ||
                school ||
                ""
            ).trim();


        if (modalSchool) {

            modalSchool.textContent =
                resolvedBulkSchool ||
                "School Not Specified";
        }


        /* -------------------------------------------------
           HEADCOUNT
           
           Column M
        ------------------------------------------------- */

        const headcount =
            Number(
                bulkInfo.headcount ??
                0
            );


        if (modalHeadcount) {

            modalHeadcount.textContent =
                headcount;
        }


        /* -------------------------------------------------
           PAYING PARTICIPANTS
           
           Column O / PAYEE
           
           IMPORTANT:
           
           DO NOT calculate:
           
               headcount - free
           
           The backend already provides PAYEE.
        ------------------------------------------------- */

        const payingParticipants =
            Number(
                bulkInfo.payingParticipants ??
                0
            );


        if (modalPaying) {

            modalPaying.textContent =
                payingParticipants;
        }


        /* -------------------------------------------------
           FREE PARTICIPANTS
           
           Column N
        ------------------------------------------------- */

        const freeParticipants =
            Number(
                bulkInfo.free ??
                0
            );


        if (modalFree) {

            modalFree.textContent =
                freeParticipants;
        }


        /* -------------------------------------------------
           MAKE SURE INDIVIDUAL SCHOOL IS HIDDEN
        ------------------------------------------------- */

        if (individualSchool) {

            individualSchool.style.display =
                "none";
        }

    }


    /* =====================================================
       INDIVIDUAL REGISTRATION
       
       IMPORTANT:
       
       There is NO registration summary.
       
       Therefore:
       
       #bulkRegistrationInfo = hidden
       
       Only the individual school is displayed.
    ===================================================== */

    else {

        console.log(
            "Rendering INDIVIDUAL registration information."
        );


        /* -------------------------------------------------
           BULK SUMMARY MUST REMAIN HIDDEN
        ------------------------------------------------- */

        if (bulkRegistrationInfo) {

            bulkRegistrationInfo.style.display =
                "none";
        }


        /* -------------------------------------------------
           SHOW INDIVIDUAL SCHOOL
        ------------------------------------------------- */

        if (individualSchool) {

            individualSchool.style.display =
                "block";
        }


        /* -------------------------------------------------
           SCHOOL MUST COME FROM THE BACKEND DATA
           
           data.school comes from Column F.
           
           The 'school' argument passed into this function
           already comes from the normalized backend response.
        ------------------------------------------------- */

        if (individualModalSchool) {

            const resolvedIndividualSchool =
                String(
                    school ||
                    ""
                ).trim();


            individualModalSchool.textContent =
                resolvedIndividualSchool ||
                "School Not Specified";
        }
    }


    /* =====================================================
       SHOW MODAL
    ===================================================== */

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


        /* -------------------------------------------------
           FORCE MODAL TO FRONT
        ------------------------------------------------- */

        requestAnimationFrame(() => {

            modalElement.style.zIndex =
                "1060";


            const backdrop =
                document.querySelector(
                    ".modal-backdrop"
                );


            if (backdrop) {

                backdrop.style.zIndex =
                    "1055";
            }

        });

    }

    catch (error) {

        console.error(
            "Unable to display result modal:",
            error
        );


        /* -------------------------------------------------
           FALLBACK
        ------------------------------------------------- */

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
        action: "scan",
        attendeeId: attendeeId,
        session: selectedSession
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
   FORMAT MODAL TIMESTAMP
========================================================= */

function formatModalTimestamp(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return String(timestamp);
    }

    return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
    }).format(date).replace(" at ", " • ");
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